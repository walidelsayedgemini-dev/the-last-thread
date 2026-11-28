/**
 * Small, explicit voice map for the game's high-impact dialogue beats.
 * Paths are public-relative so this module stays pure and easy to test.
 */
export type VoiceLineKey = `${string}:${string}:${number}`

export const VOICE_LINES: Readonly<Record<VoiceLineKey, string>> = {
  'case01:hs_mahmoud_voicemail:0': 'audio/voice/c01_intro_2.mp3',
  'case01:h_confront_right:0': 'audio/voice/c01_h_confront_player.mp3',
  'case01:h_confront_right:1': 'audio/voice/c01_h_confront_hassan.mp3',
  'case01:r_confront_right:0': 'audio/voice/c01_r_confront_player.mp3',
  'case01:r_confront_right:1': 'audio/voice/c01_r_confront_ragab.mp3',
  'case01:s_snap:0': 'audio/voice/c01_s_snap.mp3',
  'case01:m_first:2': 'audio/voice/c01_m_confession.mp3',
  'case01:ending:0': 'audio/voice/c01_end_0.mp3',
  'case01:ending:1': 'audio/voice/c01_end_1.mp3',
  'case01:ending:2': 'audio/voice/c01_end_2.mp3',
  'case01:ending:3': 'audio/voice/c01_end_3.mp3',
  'case02:a_confront:0': 'audio/voice/c02_a_confront_player.mp3',
  'case02:a_confront:1': 'audio/voice/c02_a_confront_adham.mp3',
  'case02:ending:0': 'audio/voice/c02_end_0.mp3',
  'case02:ending:1': 'audio/voice/c02_end_1.mp3',
  'case02:ending:2': 'audio/voice/c02_end_2.mp3',
}

export function voiceKey(caseId: string, nodeId: string, lineIndex: number): VoiceLineKey {
  return `${caseId}:${nodeId}:${lineIndex}`
}

export function voicePath(caseId: string, nodeId: string, lineIndex: number): string | undefined {
  return VOICE_LINES[voiceKey(caseId, nodeId, lineIndex)]
}
