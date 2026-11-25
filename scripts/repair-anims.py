#!/usr/bin/env python3
"""Repair retargeted Tripo animation clips inside character GLBs (in place).

Why: preset clips retargeted onto our rigs can (1) shift the Hip bone horizontally relative to the
idle pose, which makes the whole character slide sideways when crossfading idle -> walk/run, and
(2) end on a pose that differs from the first pose, which pops at every loop.

What it does, per file:
  * locks the Hip translation's horizontal components (local x/y) of every clip to the reference
    clip's (idle / standing_relax) first-frame values, keeping the vertical bob (local z);
  * where the wrap step (last -> first key) of a rotation/hip track is larger than its biggest
    neighbouring step, blends the last 25% of keys into the first key (smoothstep) so loops are seamless.

Usage: python3 scripts/repair-anims.py assets/models/characters/*.glb
"""
import json
import struct
import sys

import numpy as np

CT = {5126: np.float32, 5123: np.uint16, 5125: np.uint32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}


def read_glb(path):
    data = bytearray(open(path, 'rb').read())
    jl = struct.unpack_from('<I', data, 12)[0]
    doc = json.loads(bytes(data[20:20 + jl]))
    return data, doc, 20 + jl + 8, jl


def accessor(data, doc, boff, index):
    a = doc['accessors'][index]
    bv = doc['bufferViews'][a['bufferView']]
    off = boff + bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    n = NC[a['type']]
    arr = np.frombuffer(data, dtype=CT[a['componentType']], count=a['count'] * n, offset=off)
    return arr.reshape(a['count'], n)


def sync_bounds(doc, index, arr):
    a = doc['accessors'][index]
    a['min'] = [float(x) for x in arr.min(axis=0)]
    a['max'] = [float(x) for x in arr.max(axis=0)]


def blend_tail(arr, quat):
    """Make the last key equal the first key by blending the final 25% of keys. Returns True if changed."""
    n = len(arr)
    if n < 6:
        return False
    work = arr.astype(np.float64)
    if quat:
        for i in range(1, n):
            if np.dot(work[i], work[i - 1]) < 0:
                work[i] = -work[i]
    steps = np.linalg.norm(np.diff(work, axis=0), axis=1)
    first = work[0]
    wrap = np.linalg.norm(first - work[-1])
    if wrap <= steps.max() * 1.0 + 1e-9:
        return False
    k = max(2, round((n - 1) * 0.25))
    for i in range(n - k, n):
        w = (i - (n - k) + 1) / k
        w = w * w * (3 - 2 * w)
        work[i] = (1 - w) * work[i] + w * first
        if quat:
            work[i] /= np.linalg.norm(work[i])
    arr[:] = work.astype(arr.dtype)
    return True


def repair(path):
    data, doc, boff, jl = read_glb(path)
    names = [n.get('name') for n in doc['nodes']]
    hip = names.index('Hip')
    clips = {a['name']: a for a in doc['animations']}
    ref_name = 'idle' if 'idle' in clips else ('standing_relax' if 'standing_relax' in clips else next(iter(clips)))

    def hip_track(clip):
        for ch in clip['channels']:
            if ch['target']['node'] == hip and ch['target']['path'] == 'translation':
                return clip['samplers'][ch['sampler']]['output']
        return None

    ref_idx = hip_track(clips[ref_name])
    ref_xy = accessor(data, doc, boff, ref_idx)[0, :2].copy()
    report = []
    for name, clip in clips.items():
        locked = False
        blended = 0
        idx = hip_track(clip)
        if idx is not None and name != ref_name:
            tr = accessor(data, doc, boff, idx)
            tr[:, 0] = ref_xy[0]
            tr[:, 1] = ref_xy[1]
            sync_bounds(doc, idx, tr)
            locked = True
        for ch in clip['channels']:
            path_ = ch['target']['path']
            out = clip['samplers'][ch['sampler']]['output']
            if path_ == 'rotation':
                if blend_tail(accessor(data, doc, boff, out), True):
                    sync_bounds(doc, out, accessor(data, doc, boff, out))
                    blended += 1
            elif path_ == 'translation' and ch['target']['node'] == hip:
                if blend_tail(accessor(data, doc, boff, out), False):
                    sync_bounds(doc, out, accessor(data, doc, boff, out))
                    blended += 1
        report.append(f'{name}: hip-lock={locked} seam-blended-tracks={blended}')
    new_json = json.dumps(doc, separators=(',', ':')).encode()
    new_json += b' ' * ((4 - len(new_json) % 4) % 4)
    bin_chunk = bytes(data[20 + jl:])
    total = 12 + 8 + len(new_json) + len(bin_chunk)
    out = struct.pack('<III', 0x46546C67, 2, total) + struct.pack('<II', len(new_json), 0x4E4F534A) + new_json + bin_chunk
    open(path, 'wb').write(out)
    print(path.split('/')[-1], '|', '; '.join(report))


if __name__ == '__main__':
    for p in sys.argv[1:]:
        repair(p)
