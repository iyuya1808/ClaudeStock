import YahooFinanceClass from 'yahoo-finance2';
const yahooFinance = new YahooFinanceClass();

async function test() {
  try {
    const symbol = '7203.T';
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6);
    
    console.log('Testing historical for:', symbol);
    console.log('startDate:', startDate.toISOString().split('T')[0]);
    
    const result = await yahooFinance.historical(symbol, {
      period1: startDate.toISOString().split('T')[0],
      interval: '1d'
    });
    
    console.log('Success! Count:', result.length);
    console.log('First item:', result[0]);
  } catch (e) {
    console.error('Error:', e.message);
    if (e.errors) console.error('Detailed Errors:', e.errors);
  }
}

test();
