module.exports = {
  priceInquiryAgent: {
    execute: jest.fn().mockResolvedValue({
      result: {
        symbol: 'BTCUSDT',
        price: '50000',
        message: 'BTCの現在価格は50,000 USDTです'
      }
    })
  }
};