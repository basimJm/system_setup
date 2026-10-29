import { useState } from 'react';
import { cx } from '../../utils/cx';
import { initialsOf } from '../../utils/initials';

export interface AvatarProps {
  /** Person or organisation name: used for the initials and the accessible name. */
  name: string;
  /** Picture URL; the initials show when it is missing or fails to load. */
  src?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  // Remember which URL failed, so a new `src` gets its own chance to load.
  const [failed, setFailed] = useState<string | null>(null);
  const showPicture = src !== undefined && src !== '' && failed !== src;
  return (
    <span
      className={cx('app-avatar', `app-avatar--${size}`, className)}
      role="img"
      aria-label={name}
    >
      {showPicture ? (
        <img src={src} alt="" loading="lazy" onError={() => setFailed(src)} />
      ) : (
        <span aria-hidden="true">{initialsOf(name)}</span>
      )}
    </span>
  );
}
