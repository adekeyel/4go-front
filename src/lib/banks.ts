export const NIGERIAN_BANKS: Record<string, string> = {
  "044": "Access Bank",
  "023": "Citibank Nigeria",
  "063": "Diamond Bank (Access)",
  "050": "Ecobank Nigeria",
  "084": "Enterprise Bank",
  "070": "Fidelity Bank",
  "011": "First Bank of Nigeria",
  "214": "First City Monument Bank",
  "058": "GTBank",
  "030": "Heritage Bank",
  "301": "Jaiz Bank",
  "082": "Keystone Bank",
  "526": "Kuda MFB",
  "100": "Moniepoint MFB",
  "999992": "Opay",
  "999991": "PalmPay",
  "076": "Polaris Bank",
  "101": "Providus Bank",
  "221": "Stanbic IBTC Bank",
  "068": "Standard Chartered",
  "232": "Sterling Bank",
  "100004": "Suntrust Bank",
  "032": "Union Bank",
  "033": "UBA",
  "215": "Unity Bank",
  "035": "Wema Bank",
  "057": "Zenith Bank",
};

export function getBankName(code: string): string {
  return NIGERIAN_BANKS[code] || code;
}
