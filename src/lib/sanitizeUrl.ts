const TRACKING_PARAM_PREFIXES = [
	'utm_', // UTM campaign attribution (Google / generic)
	'ga_', // Google Analytics legacy params
	'pk_', // Matomo (Piwik)
	'hsa_', // HubSpot Ads
	'oly_', // Omeda / Olytics
	'vero_', // Vero email marketing
	'elq', // Eloqua
	'mc_', // Mailchimp
	'amp_', // Google AMP cache / viewer tracking
	'icn_', // Campaign / newsletter tools
	'tt_', // TikTok campaigns
	'fb_action_', // Facebook action-level reporting
	'ig_', // Instagram-specific tags
	's_cid', // Adobe Analytics campaign id
	'trk' // Generic tracking (trk, trkcampaign, etc.)
];

const TRACKING_PARAM_NAMES = new Set(
	[
		// --- UTM / campaign attribution ---
		'utm_source',
		'utm_medium',
		'utm_campaign',
		'utm_content',
		'utm_term',
		'utm_id',
		'utm_name',
		'utm_reader',
		'utm_viz_id',
		'utm_pubreferrer',
		'utm_social',
		'utm_social-type',
		'utm_creative',
		'utm_place',
		'utm_bc',
		'utm-campaign',
		'utm-medium',
		'utm-source',

		// --- Google Ads / Analytics ---
		'gclid', // Google Ads click id
		'gbraid', // Google Ads (iOS / privacy-preserving)
		'wbraid', // Google Ads (iOS / privacy-preserving)
		'dclid', // Display & Video 360
		'gclsrc', // Google Ads source hint
		'_ga', // GA client id / linker decoration
		'_gl', // GA4 cross-domain linker
		'_gcl', // Google conversion linker
		'ga_campaign',
		'ga_source',
		'ga_medium',
		'ga_term',
		'ga_content',

		// --- Microsoft / other ad networks ---
		'msclkid', // Microsoft Ads click id
		'yclid', // Yandex Ads
		'twclid', // Twitter / X Ads

		// --- Meta / TikTok ---
		'fbclid', // Facebook click id
		'fb_action_ids',
		'igshid', // Instagram share id
		'ttclid', // TikTok click id
		'ttadid', // TikTok ad id

		// --- Email / ESPs ---
		'mc_cid', // Mailchimp campaign id
		'mc_eid', // Mailchimp email/user id
		'mkt_tok', // Marketo tracking token
		'ck_subscriber_id',
		'ml_subscriber',
		'ml_subscriber_hash',
		'_hsenc', // HubSpot email encoding
		'_hsmi', // HubSpot message id
		'__hsfp',
		'__hssc',
		'__hstc',
		'hsctatracking',

		// --- Adobe Experience Cloud ---
		'adobe_mc', // Cross-domain identity sharing
		'adobe_mc_ref', // Adobe referrer decoration
		'adobe_mc_sdid', // Supplemental data id

		// --- Matomo ---
		'pk_campaign',
		'pk_kwd',
		'pk_source',
		'pk_medium',
		'pk_content',
		'pk_cid',

		// --- Affiliate / referral tracking ---
		'irclickid', // Impact
		'clickid', // Generic affiliate click id
		'aff_id',
		'affid',
		'aff_sub',
		'aff_sub2',
		'aff_sub3',
		'aff_sub4',
		'aff_sub5',
		's_kwcid', // Google / partner keyword id
		'spm', // Alibaba / Taobao style tracking

		// --- Referrer noise ---
		'ref',
		'ref_src',
		'ref_url',
		'referrer',

		// --- Misc / vendor-specific ---
		'adid',
		'wickedid',
		'trk',
		'trkcampaign',
		'vero_conv',
		'vero_subscriber_id',
		'vero_newsletter_id',
		'vero_id',
		'oly_enc_id',
		'oly_anon_id'
	].map((name) => name.toLowerCase())
);

function isTrackingParam(name: string) {
	const lowered = name.toLowerCase();
	const normalized = lowered.replace(/-/g, '_'); // utm-social -> utm_social

	return (
		TRACKING_PARAM_NAMES.has(lowered) ||
		TRACKING_PARAM_NAMES.has(normalized) ||
		TRACKING_PARAM_PREFIXES.some((prefix) => lowered.startsWith(prefix)) ||
		TRACKING_PARAM_PREFIXES.some((prefix) => normalized.startsWith(prefix))
	);
}

/**
 * Remove empty and tracking query parameters to shorten URLs while preserving intent.
 */
export function sanitizeUrl(rawUrl: string): string {
	try {
		const normalized = rawUrl.trim();
		let modified = false;

		const parsed = new URL(normalized);
		const originalSearch = parsed.search;
		const params = parsed.searchParams;

		for (const key of Array.from(params.keys())) {
			const value = params.get(key);
			const emptyValue = value === null || value.trim() === '';

			if (emptyValue || isTrackingParam(key)) {
				params.delete(key);
				modified = true;
			}
		}

		const nextSearch = params.toString();
		const newSearch = nextSearch ? `?${nextSearch}` : '';

		if (newSearch !== originalSearch) {
			parsed.search = newSearch;
			modified = true;
		}

		return modified ? parsed.toString() : normalized;
	} catch {
		// Invalid URL or unsupported scheme — leave untouched
		return rawUrl;
	}
}
