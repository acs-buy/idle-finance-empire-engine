export const ANALYTICS_EVENTS = {
  LANDING_VIEW: "landing_view",
  CLICK_PLAY: "click_play",
  GAME_START: "game_start",
  FIRST_PURCHASE_ASSET: "first_purchase_asset",
  FIRST_UPGRADE: "first_upgrade",
  PRESTIGE_UNLOCKED: "prestige_unlocked",
  VIP_VIEWED: "vip_viewed",
  VIP_PLACEMENT_SHOWN: "vip_placement_shown",
  VIP_PLACEMENT_CLICKED: "vip_placement_clicked",
  CHECKOUT_STARTED: "checkout_started",
  SAVE_AND_EXIT_CLICKED: "save_and_exit_clicked",
  CLOUD_SAVE_SUCCEEDED: "cloud_save_succeeded",
  CLOUD_SAVE_LOADED: "cloud_save_loaded",
  DEMO_VIEW: "demo_view",
  SHARE_CLICKED: "share_clicked",
  SHARE_DOWNLOADED: "share_downloaded",
  SHARE_SHARED: "share_shared",
  SESSION_END: "session_end",
} as const;

export type AnalyticsEventName =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];
