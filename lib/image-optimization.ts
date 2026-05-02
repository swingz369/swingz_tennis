import { ImageProps } from 'next/image';

export interface OptimizedImageProps extends Omit<ImageProps, 'src'> {
  src: string;
  width?: number;
  height?: number;
}

export function getOptimizedImageProps(
  src: string,
  options: Partial<OptimizedImageProps> = {}
): OptimizedImageProps {
  const defaultWidth = 800;
  const defaultHeight = 600;

  return {
    src,
    width: options.width || defaultWidth,
    height: options.height || defaultHeight,
    alt: options.alt || '',
    priority: options.priority || false,
    loading: options.loading || 'lazy',
    quality: options.quality || 75,
    placeholder: options.placeholder || 'blur',
    ...options,
  };
}

export function getAvatarProps(userId: string, size: number = 64): OptimizedImageProps {
  return getOptimizedImageProps(`/api/avatar/${userId}`, {
    width: size,
    height: size,
    alt: `User avatar`,
  });
}

export function getClubLogoProps(clubId: string, size: number = 200): OptimizedImageProps {
  return getOptimizedImageProps(`/api/clubs/${clubId}/logo`, {
    width: size,
    height: size,
    alt: `Club logo`,
  });
}
