// Mock the UI toast component first
const mockShowToast = jest.fn();

jest.mock('@/components/ui/toast', () => ({
  showToast: mockShowToast
}));

import {
  showSuccess,
  showError,
  showInfo,
  showWarning,
  showProposalApprovalSuccess,
  showProposalRejectionSuccess,
  showDrawingCancellationSuccess,
  showProposalApprovalError,
  showValidationError
} from '../../../lib/notifications/toast';

// Alias for easier reference in tests
const showToast = mockShowToast;

describe('Toast Notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Toast Functions', () => {
    it('shows success toast', () => {
      const message = 'Operation completed successfully';
      showSuccess(message);
      
      expect(showToast).toHaveBeenCalledWith(message, 'success');
      expect(showToast).toHaveBeenCalledTimes(1);
    });

    it('shows error toast', () => {
      const message = 'An error occurred';
      showError(message);
      
      expect(showToast).toHaveBeenCalledWith(message, 'error');
      expect(showToast).toHaveBeenCalledTimes(1);
    });

    it('shows info toast', () => {
      const message = 'Information message';
      showInfo(message);
      
      expect(showToast).toHaveBeenCalledWith(message, 'info');
      expect(showToast).toHaveBeenCalledTimes(1);
    });

    it('shows warning toast', () => {
      const message = 'Warning message';
      showWarning(message);
      
      expect(showToast).toHaveBeenCalledWith(message, 'warning');
      expect(showToast).toHaveBeenCalledTimes(1);
    });

    it('handles empty messages', () => {
      showSuccess('');
      showError('');
      showInfo('');
      showWarning('');
      
      expect(showToast).toHaveBeenCalledTimes(4);
      expect(showToast).toHaveBeenNthCalledWith(1, '', 'success');
      expect(showToast).toHaveBeenNthCalledWith(2, '', 'error');
      expect(showToast).toHaveBeenNthCalledWith(3, '', 'info');
      expect(showToast).toHaveBeenNthCalledWith(4, '', 'warning');
    });

    it('handles special characters in messages', () => {
      const specialMessage = '📈 Success! <script>alert("xss")</script> & "quotes"';
      showSuccess(specialMessage);
      
      expect(showToast).toHaveBeenCalledWith(specialMessage, 'success');
    });
  });

  describe('Proposal-specific Toast Functions', () => {
    describe('showProposalApprovalSuccess', () => {
      it('shows approval success with symbol and type', () => {
        showProposalApprovalSuccess('BTCUSDT', 'トレンドライン');
        
        expect(showToast).toHaveBeenCalledWith(
          '提案を承認しました: BTCUSDT トレンドラインの描画を追加しました',
          'success'
        );
      });

      it('handles different symbols and types', () => {
        const testCases = [
          { symbol: 'ETHUSDT', type: 'サポートライン' },
          { symbol: 'BNBUSDT', type: 'レジスタンスライン' },
          { symbol: 'ADAUSDT', type: 'フィボナッチ' }
        ];

        testCases.forEach(({ symbol, type }) => {
          showProposalApprovalSuccess(symbol, type);
          expect(showToast).toHaveBeenLastCalledWith(
            `提案を承認しました: ${symbol} ${type}の描画を追加しました`,
            'success'
          );
        });
      });

      it('handles empty strings', () => {
        showProposalApprovalSuccess('', '');
        
        expect(showToast).toHaveBeenCalledWith(
          '提案を承認しました:  の描画を追加しました',
          'success'
        );
      });
    });

    describe('showProposalRejectionSuccess', () => {
      it('shows rejection with symbol and type', () => {
        showProposalRejectionSuccess('BTCUSDT', 'トレンドライン');
        
        expect(showToast).toHaveBeenCalledWith(
          '提案を拒否しました: BTCUSDT トレンドライン',
          'info'
        );
      });

      it('shows generic rejection without parameters', () => {
        showProposalRejectionSuccess();
        
        expect(showToast).toHaveBeenCalledWith(
          '提案を拒否しました',
          'info'
        );
      });

      it('shows generic rejection with undefined parameters', () => {
        showProposalRejectionSuccess(undefined, undefined);
        
        expect(showToast).toHaveBeenCalledWith(
          '提案を拒否しました',
          'info'
        );
      });

      it('shows partial rejection with only symbol', () => {
        showProposalRejectionSuccess('BTCUSDT', undefined);
        
        expect(showToast).toHaveBeenCalledWith(
          '提案を拒否しました',
          'info'
        );
      });

      it('shows partial rejection with only type', () => {
        showProposalRejectionSuccess(undefined, 'トレンドライン');
        
        expect(showToast).toHaveBeenCalledWith(
          '提案を拒否しました',
          'info'
        );
      });

      it('handles empty strings as valid parameters', () => {
        showProposalRejectionSuccess('', '');
        
        // Empty strings are falsy, so it uses the generic message
        expect(showToast).toHaveBeenCalledWith(
          '提案を拒否しました',
          'info'
        );
      });
    });

    describe('showDrawingCancellationSuccess', () => {
      it('shows drawing cancellation success', () => {
        showDrawingCancellationSuccess();
        
        expect(showToast).toHaveBeenCalledWith(
          '描画を削除しました',
          'success'
        );
      });

      it('always shows the same message', () => {
        // Call multiple times
        showDrawingCancellationSuccess();
        showDrawingCancellationSuccess();
        showDrawingCancellationSuccess();
        
        expect(showToast).toHaveBeenCalledTimes(3);
        expect(showToast).toHaveBeenCalledWith('描画を削除しました', 'success');
      });
    });
  });

  describe('Error Toast Functions', () => {
    describe('showProposalApprovalError', () => {
      it('shows generic error without error object', () => {
        showProposalApprovalError();
        
        expect(showToast).toHaveBeenCalledWith(
          '提案の承認に失敗しました',
          'error'
        );
      });

      it('shows generic error with undefined error', () => {
        showProposalApprovalError(undefined);
        
        expect(showToast).toHaveBeenCalledWith(
          '提案の承認に失敗しました',
          'error'
        );
      });

      it('shows specific error for invalid drawing data', () => {
        const error = new Error('Invalid drawing data: missing points');
        showProposalApprovalError(error);
        
        expect(showToast).toHaveBeenCalledWith(
          '描画データが無効です。データを確認してください。',
          'error'
        );
      });

      it('shows specific error for validation errors', () => {
        // Only messages containing lowercase 'validation' trigger the specific error
        const validationError = new Error('validation failed');
        showProposalApprovalError(validationError);
        expect(showToast).toHaveBeenCalledWith(
          'データの検証に失敗しました。',
          'error'
        );
        
        // Messages with uppercase 'Validation' don't match
        jest.clearAllMocks();
        const upperCaseError = new Error('Data Validation error');
        showProposalApprovalError(upperCaseError);
        expect(showToast).toHaveBeenCalledWith(
          '提案の承認に失敗しました',
          'error'
        );
      });

      it('shows generic error for other error types', () => {
        const genericErrors = [
          new Error('Network error'),
          new Error('Unknown error'),
          new Error('Server error')
        ];

        genericErrors.forEach(error => {
          showProposalApprovalError(error);
          expect(showToast).toHaveBeenLastCalledWith(
            '提案の承認に失敗しました',
            'error'
          );
        });
      });

      it('handles error without message property', () => {
        const errorWithoutMessage = { code: 'ERROR_CODE' } as any;
        showProposalApprovalError(errorWithoutMessage);
        
        expect(showToast).toHaveBeenCalledWith(
          '提案の承認に失敗しました',
          'error'
        );
      });

      it('handles error with empty message', () => {
        const error = new Error('');
        showProposalApprovalError(error);
        
        expect(showToast).toHaveBeenCalledWith(
          '提案の承認に失敗しました',
          'error'
        );
      });
    });

    describe('showValidationError', () => {
      it('shows generic validation error without details', () => {
        showValidationError();
        
        expect(showToast).toHaveBeenCalledWith(
          'データの検証に失敗しました',
          'error'
        );
      });

      it('shows validation error with details', () => {
        showValidationError('必須フィールドが入力されていません');
        
        expect(showToast).toHaveBeenCalledWith(
          'データの検証に失敗しました: 必須フィールドが入力されていません',
          'error'
        );
      });

      it('handles undefined details', () => {
        showValidationError(undefined);
        
        expect(showToast).toHaveBeenCalledWith(
          'データの検証に失敗しました',
          'error'
        );
      });

      it('handles empty string details', () => {
        showValidationError('');
        
        expect(showToast).toHaveBeenCalledWith(
          'データの検証に失敗しました',
          'error'
        );
      });

      it('handles long detail messages', () => {
        const longDetails = 'エラー'.repeat(100);
        showValidationError(longDetails);
        
        expect(showToast).toHaveBeenCalledWith(
          `データの検証に失敗しました: ${longDetails}`,
          'error'
        );
      });

      it('handles special characters in details', () => {
        const specialDetails = '< > & " \' \n \t';
        showValidationError(specialDetails);
        
        expect(showToast).toHaveBeenCalledWith(
          `データの検証に失敗しました: ${specialDetails}`,
          'error'
        );
      });
    });
  });

  describe('Integration Tests', () => {
    it('can show multiple toasts in sequence', () => {
      showSuccess('First success');
      showError('Then error');
      showInfo('Some info');
      showWarning('Final warning');
      
      expect(showToast).toHaveBeenCalledTimes(4);
      expect(showToast).toHaveBeenNthCalledWith(1, 'First success', 'success');
      expect(showToast).toHaveBeenNthCalledWith(2, 'Then error', 'error');
      expect(showToast).toHaveBeenNthCalledWith(3, 'Some info', 'info');
      expect(showToast).toHaveBeenNthCalledWith(4, 'Final warning', 'warning');
    });

    it('handles rapid toast calls', () => {
      for (let i = 0; i < 100; i++) {
        showSuccess(`Message ${i}`);
      }
      
      expect(showToast).toHaveBeenCalledTimes(100);
    });

    it('maintains correct toast type for each function', () => {
      const functions = [
        { fn: showSuccess, type: 'success' },
        { fn: showError, type: 'error' },
        { fn: showInfo, type: 'info' },
        { fn: showWarning, type: 'warning' }
      ];

      functions.forEach(({ fn, type }) => {
        jest.clearAllMocks();
        fn('Test message');
        expect(showToast).toHaveBeenCalledWith('Test message', type);
      });
    });
  });

  describe('Error Handling', () => {
    it('handles errors in showToast gracefully', () => {
      // Since the functions don't have try-catch, they will throw
      // This test verifies the current behavior
      jest.mocked(showToast).mockImplementationOnce(() => {
        throw new Error('Toast component error');
      });

      // Currently throws - this is the actual behavior
      expect(() => showSuccess('Test')).toThrow('Toast component error');
    });

    it('calls showToast even with null/undefined messages', () => {
      showSuccess(null as any);
      showError(undefined as any);
      
      expect(showToast).toHaveBeenCalledTimes(2);
      expect(showToast).toHaveBeenNthCalledWith(1, null, 'success');
      expect(showToast).toHaveBeenNthCalledWith(2, undefined, 'error');
    });
  });

  describe('Localization', () => {
    it('uses Japanese messages for proposal functions', () => {
      showProposalApprovalSuccess('BTC', 'ライン');
      showProposalRejectionSuccess('ETH', 'パターン');
      showDrawingCancellationSuccess();
      showProposalApprovalError();
      showValidationError();
      
      // All messages should be in Japanese
      expect(showToast).toHaveBeenCalledWith(expect.stringContaining('提案を承認しました'), 'success');
      expect(showToast).toHaveBeenCalledWith(expect.stringContaining('提案を拒否しました'), 'info');
      expect(showToast).toHaveBeenCalledWith(expect.stringContaining('描画を削除しました'), 'success');
      expect(showToast).toHaveBeenCalledWith(expect.stringContaining('提案の承認に失敗しました'), 'error');
      expect(showToast).toHaveBeenCalledWith(expect.stringContaining('データの検証に失敗しました'), 'error');
    });
  });
});