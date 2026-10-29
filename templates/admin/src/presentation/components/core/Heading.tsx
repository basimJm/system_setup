import type { HTMLAttributes } from 'react';
import { cx } from '../../utils/cx';

export type HeadingLevel = 1 | 2 | 3 | 4;

export interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  /** Semantic level (document outline). */
  level: HeadingLevel;
  /** Visual level when it differs from the semantic one. */
  look?: HeadingLevel;
}

export function Heading({ level, look = level, className, ...rest }: HeadingProps) {
  const Tag = `h${String(level)}` as 'h1' | 'h2' | 'h3' | 'h4';
  return <Tag className={cx('app-heading', `app-heading--${String(look)}`, className)} {...rest} />;
}
