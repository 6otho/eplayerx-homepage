const active = new Map<string, number>();
const pending = new Map<string, Promise<boolean>>();
const entitlements = ["Pro", "pro_macos", "pro_tvos", "pro_all_access"];

/** Check RevenueCat itself, never a client-provided Pro flag or Debug unlock. */
export async function hasMediaPro(
	userID: string,
	apiKey: string,
): Promise<boolean> {
	const key = `${apiKey}:${userID}`;
	if ((active.get(key) ?? 0) > Date.now()) return true;
	const inFlight = pending.get(key);
	if (inFlight) return inFlight;
	const lookup = (async () => {
		const response = await fetch(
			`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userID)}`,
			{
				headers: {
					Authorization: `Bearer ${apiKey}`,
					Accept: "application/json",
				},
				redirect: "manual",
				signal: AbortSignal.timeout(8000),
			},
		);
		if (!response.ok) {
			await response.body?.cancel();
			throw new Error("Pro verification unavailable");
		}
		const body = (await response.json()) as {
			subscriber?: {
				entitlements?: Record<
					string,
					{
						expires_date?: string | null;
						grace_period_expires_date?: string | null;
						purchase_date?: string;
						product_identifier?: string;
					}
				>;
			};
		};
		const now = Date.now();
		let until = 0;
		for (const id of entitlements) {
			const item = body.subscriber?.entitlements?.[id];
			if (
				!item?.product_identifier ||
				!item.purchase_date ||
				!Number.isFinite(Date.parse(item.purchase_date)) ||
				Date.parse(item.purchase_date) > now
			)
				continue;
			const expiry =
				item.expires_date === null
					? Infinity
					: Date.parse(item.expires_date ?? "");
			const grace = Date.parse(item.grace_period_expires_date ?? "") || 0;
			if (Math.max(expiry, grace) > now)
				until = Math.max(
					until,
					Math.min(now + 60_000, Math.max(expiry, grace)),
				);
		}
		if (until > now) {
			if (active.size >= 1024) active.clear();
			active.set(key, until);
			return true;
		}
		return false;
	})();
	pending.set(key, lookup);
	try {
		return await lookup;
	} finally {
		pending.delete(key);
	}
}
