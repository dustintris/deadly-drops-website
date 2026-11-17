/**
 * "Pause animations" (footer switch, MotionToggle): a visitor's choice to stop the site's ambient motion,
 * kept in a first-party cookie so the server renders <html data-motion="off"> and nothing moves even
 * for a moment on the next page. Shared by the server layouts and the client switch.
 */
export const MOTION_COOKIE = 'ddp_motion'
export const MOTION_OFF = 'off'
