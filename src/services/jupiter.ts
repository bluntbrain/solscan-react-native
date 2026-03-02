// src/services/jupiter.ts
// jupiter metis swap api service for token swaps

// jupiter metis api - requires api key from portal.jup.ag
const JUPITER_API = "https://api.jup.ag/swap/v1";
const JUPITER_API_KEY = process.env.EXPO_PUBLIC_JUPITER_API_KEY || "";

// well-known token mints on solana mainnet
export const TOKENS = {
  SOL: "So11111111111111111111111111111111111111112", // wrapped SOL
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  JUP: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  WIF: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
};

// token metadata for display
export const TOKEN_INFO: Record<
  string,
  { symbol: string; name: string; decimals: number; color: string }
> = {
  [TOKENS.SOL]: { symbol: "SOL", name: "Solana", decimals: 9, color: "#9945FF" },
  [TOKENS.USDC]: { symbol: "USDC", name: "USD Coin", decimals: 6, color: "#2775CA" },
  [TOKENS.USDT]: { symbol: "USDT", name: "Tether", decimals: 6, color: "#26A17B" },
  [TOKENS.BONK]: { symbol: "BONK", name: "Bonk", decimals: 5, color: "#F7931A" },
  [TOKENS.JUP]: { symbol: "JUP", name: "Jupiter", decimals: 6, color: "#14F195" },
  [TOKENS.WIF]: { symbol: "WIF", name: "dogwifhat", decimals: 6, color: "#E91E63" },
};

// list of available tokens for the picker
export const AVAILABLE_TOKENS = [
  TOKENS.SOL,
  TOKENS.USDC,
  TOKENS.USDT,
  TOKENS.BONK,
  TOKENS.JUP,
  TOKENS.WIF,
];

export interface QuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount?: string;
      feeMint?: string;
    };
    percent: number;
  }>;
}

// ============================================
// GET QUOTE - how much will user receive?
// ============================================
export async function getSwapQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number = 50
): Promise<QuoteResponse> {
  console.log("[jupiter] ========== getSwapQuote ==========");
  console.log("[jupiter] inputMint:", inputMint);
  console.log("[jupiter] outputMint:", outputMint);
  console.log("[jupiter] amount (smallest unit):", amount);
  console.log("[jupiter] slippageBps:", slippageBps, `(${slippageBps / 100}%)`);

  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount: amount.toString(),
    slippageBps: slippageBps.toString(),
  });

  const url = `${JUPITER_API}/quote?${params}`;
  console.log("[jupiter] fetching quote from:", url);
  console.log("[jupiter] using API key:", JUPITER_API_KEY ? "yes (set)" : "no (missing!)");

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`[jupiter] attempt ${attempt}/3...`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "x-api-key": JUPITER_API_KEY,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[jupiter] quote failed:", response.status, errorText);
        throw new Error(`Jupiter quote failed: ${response.status}`);
      }

      const quote = await response.json();
      console.log("[jupiter] quote received:");
      console.log("[jupiter]   - inAmount:", quote.inAmount);
      console.log("[jupiter]   - outAmount:", quote.outAmount);
      console.log("[jupiter]   - priceImpactPct:", quote.priceImpactPct, "%");
      console.log("[jupiter]   - routes:", quote.routePlan?.length || 0);
      if (quote.routePlan?.length > 0) {
        console.log("[jupiter]   - route:", quote.routePlan.map((r: { swapInfo: { label: string } }) => r.swapInfo.label).join(" -> "));
      }
      console.log("[jupiter] ======================================");
      return quote;
    } catch (err) {
      lastError = err as Error;
      console.log(`[jupiter] attempt ${attempt} failed:`, lastError.message);
      if (attempt < 3) {
        console.log("[jupiter] retrying in 1 second...");
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  throw lastError || new Error("Failed to get quote after 3 attempts");
}

// ============================================
// GET SWAP TRANSACTION - ready to sign
// ============================================
export async function getSwapTransaction(
  quoteResponse: QuoteResponse,
  userPublicKey: string
): Promise<string> {
  console.log("[jupiter] ========== getSwapTransaction ==========");
  console.log("[jupiter] userPublicKey:", userPublicKey);
  console.log("[jupiter] quote inAmount:", quoteResponse.inAmount);
  console.log("[jupiter] quote outAmount:", quoteResponse.outAmount);
  console.log("[jupiter] slippageBps:", quoteResponse.slippageBps);

  const swapUrl = `${JUPITER_API}/swap`;
  console.log("[jupiter] posting to:", swapUrl);

  // build request body with explanations
  const requestBody = {
    // the quote we got from /quote endpoint
    quoteResponse,
    // user's wallet address that will sign the transaction
    userPublicKey,
    // auto wrap SOL to wSOL and unwrap wSOL to SOL (for SOL swaps)
    wrapAndUnwrapSol: true,
    // dynamically calculate compute units needed (saves fees)
    dynamicComputeUnitLimit: true,
    // priority fee settings to land transaction faster
    prioritizationFeeLamports: {
      priorityLevelWithMaxLamports: {
        // priority level: medium, high, or veryHigh
        priorityLevel: "high",
        // max lamports willing to pay for priority (cap to prevent overpaying)
        maxLamports: 1000000, // 0.001 SOL max priority fee
      },
    },
  };

  console.log("[jupiter] request options:");
  console.log("[jupiter]   - wrapAndUnwrapSol: true (auto handle SOL <-> wSOL)");
  console.log("[jupiter]   - dynamicComputeUnitLimit: true (optimize compute units)");
  console.log("[jupiter]   - priorityLevel: high (faster tx landing)");
  console.log("[jupiter]   - maxLamports: 1000000 (max 0.001 SOL priority fee)");

  const response = await fetch(swapUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-api-key": JUPITER_API_KEY,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[jupiter] swap tx failed:", response.status, errorText);
    throw new Error(`Jupiter swap failed: ${response.status}`);
  }

  const data = await response.json();
  console.log("[jupiter] swap transaction received successfully");
  console.log("[jupiter] lastValidBlockHeight:", data.lastValidBlockHeight);
  console.log("[jupiter] prioritizationFeeLamports:", data.prioritizationFeeLamports);
  console.log("[jupiter] ==========================================");

  return data.swapTransaction;
}

// ============================================
// GET TOKEN PRICE - current USD price
// ============================================
export async function getTokenPrice(mintAddress: string): Promise<number> {
  try {
    const response = await fetch(
      `https://api.jup.ag/price/v2?ids=${mintAddress}`,
      {
        headers: {
          "x-api-key": JUPITER_API_KEY,
        },
      }
    );
    const data = await response.json();
    return data.data?.[mintAddress]?.price || 0;
  } catch {
    return 0;
  }
}

// ============================================
// UNIT CONVERSION HELPERS
// ============================================
export function toSmallestUnit(amount: number, decimals: number): number {
  return Math.round(amount * Math.pow(10, decimals));
}

export function fromSmallestUnit(
  amount: number | string,
  decimals: number
): number {
  return Number(amount) / Math.pow(10, decimals);
}
