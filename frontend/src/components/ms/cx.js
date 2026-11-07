/** Spojí názvy tříd a vynechá prázdné hodnoty: cx('a', cond && 'b') → 'a b'. */
export const cx = (...classes) => classes.filter(Boolean).join(' ');
