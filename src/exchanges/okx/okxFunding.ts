import { z } from "zod";

const OkxFundingResp = z.object({
  code: z.string(),
  data: z.array(z.object({
    instId: z.string(),
    fundingRate: z.string(),
    nextFundingTime: z.string()
  }).passthrough())
});

export async function fetchOkxFunding(restBaseUrl: string, instId: string) {
  const u = new URL("/api/v5/public/funding-rate", restBaseUrl);
  u.searchParams.set("instId", instId);

  const res = await fetch(u);
  if (!res.ok) throw new Error(`OKX funding-rate ${res.status}`);

  const json = OkxFundingResp.parse(await res.json());
  const row = json.data[0];
  if (!row) throw new Error("OKX funding-rate empty");

  return {
    rate: Number(row.fundingRate),
    nextFundingTime: Number(row.nextFundingTime)
  };
}
