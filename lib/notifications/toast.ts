import { showToast as showToastComponent } from '@/components/ui/toast';

/**
 * Show success toast notification
 */
export function showSuccess(message: string): void {
  showToastComponent(message, 'success');
}

/**
 * Show error toast notification
 */
export function showError(message: string): void {
  showToastComponent(message, 'error');
}

/**
 * Show info toast notification
 */
export function showInfo(message: string): void {
  showToastComponent(message, 'info');
}

/**
 * Show warning toast notification
 */
export function showWarning(message: string): void {
  showToastComponent(message, 'warning');
}

/**
 * Show proposal approval success notification
 */
export function showProposalApprovalSuccess(symbol: string, type: string): void {
  showSuccess(`提案を承認しました: ${symbol} ${type}の描画を追加しました`);
}

/**
 * Show proposal rejection success notification
 */
export function showProposalRejectionSuccess(symbol?: string, type?: string): void {
  const message = symbol && type 
    ? `提案を拒否しました: ${symbol} ${type}`
    : '提案を拒否しました';
  showInfo(message);
}

/**
 * Show drawing cancellation success notification
 */
export function showDrawingCancellationSuccess(): void {
  showSuccess('描画を削除しました');
}

/**
 * Show proposal approval error notification
 */
export function showProposalApprovalError(error?: Error): void {
  let errorMessage = '提案の承認に失敗しました';
  
  if (error?.message) {
    if (error.message.includes('Invalid drawing data')) {
      errorMessage = '描画データが無効です。データを確認してください。';
    } else if (error.message.includes('validation')) {
      errorMessage = 'データの検証に失敗しました。';
    }
  }
  
  showError(errorMessage);
}

/**
 * Show generic validation error notification
 */
export function showValidationError(details?: string): void {
  const message = details 
    ? `データの検証に失敗しました: ${details}`
    : 'データの検証に失敗しました';
  showError(message);
}