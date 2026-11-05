/**
 * The engraver's mark for a ship: a path in screen pixels about a centre,
 * drawn with `transform="translate(x y) scale(px)"` so it stays one size
 * whatever the chart's size.
 */

/** A ship under sail, about 18 px across: hull, two masts, two sails, a pennant. */
export const SHIP = {
  hull: 'M-9,2 C-6,7.5 6,7.5 9,2 Z',
  masts: 'M-3,2 V-9 M3,2 V-11',
  sails: 'M-3,-8 C0.8,-6 0.8,-1.5 -3,-0.5 Z M3,-10 C7.5,-7 7.5,-1.5 3,0 Z',
  pennant: 'M3,-11 L8,-10 L3,-9 Z',
};
