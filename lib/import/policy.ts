export function assertImportReady(batch: { status: string; error_rows: number }) {
  if (batch.status !== 'VALIDATED') throw new Error('검증 완료 batch만 import할 수 있습니다');
  if (batch.error_rows > 0) throw new Error('ERROR 행이 있는 batch는 import할 수 없습니다');
}

export function assertReplaceConfirmed(importMode: string, confirmed: boolean) {
  if (importMode === 'replace' && !confirmed) throw new Error('replace는 사용자 확인이 필요합니다');
}
