import type { CaseFile } from './types'
import { CASE_01 } from './case01'
import { CASE_02 } from './case02'
import { CASE_03 } from './case03'

const CASES: CaseFile[] = [CASE_01, CASE_02, CASE_03]
const CASE_BY_ID: Readonly<Record<string, CaseFile>> = Object.fromEntries(CASES.map(file => [file.id, file]))
export function getCase(id: string): CaseFile {
  return CASE_BY_ID[id] ?? CASE_01
}
export function nextCaseId(id: string): string | undefined {
  const index = CASES.findIndex(file => file.id === id)
  return index >= 0 ? CASES[index + 1]?.id : undefined
}
