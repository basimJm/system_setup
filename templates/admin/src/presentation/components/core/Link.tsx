import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { cx } from '../../utils/cx';
import { isSafeExternalHref } from '../../utils/safeHref';

interface BaseProps {
  children: ReactNode;
  className?: string;
}
export interface InternalLinkProps extends BaseProps {
  /** In-app route (from `constants/routes`). */
  to: string;
}
export interface ExternalLinkProps
  extends
    BaseProps,
    Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'children' | 'className'> {
  /** Absolute http(s), mailto or tel link. Anything else renders as plain text. */
  href: string;
}

/** Router link for in-app routes, safe anchor for external ones (opens in a new tab without leaking the opener). */
export function Link(props: InternalLinkProps | ExternalLinkProps) {
  if ('to' in props) {
    return (
      <RouterLink to={props.to} className={cx('app-link', props.className)}>
        {props.children}
      </RouterLink>
    );
  }
  const { href, children, className, ...rest } = props;
  if (!isSafeExternalHref(href)) return <span className={className}>{children}</span>;
  return (
    <a
      className={cx('app-link', className)}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      {...rest}
    >
      {children}
    </a>
  );
}
