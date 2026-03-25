type HeaderReader = Pick<Headers, 'get'>;

function getFirstHeaderValue(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const [firstValue] = value.split(',');
  return firstValue?.trim() || null;
}

export function getRequestHostname(
  headers: HeaderReader,
  fallbackHostname = '',
): string {
  return (
    getFirstHeaderValue(headers.get('x-forwarded-host')) ||
    getFirstHeaderValue(headers.get('host')) ||
    fallbackHostname
  );
}

export function getRequestOrigin(
  headers: HeaderReader,
  fallbackHostname = '',
  fallbackProtocol = 'http:',
): string | null {
  const hostname = getRequestHostname(headers, fallbackHostname);
  if (!hostname) {
    return null;
  }

  const forwardedProto = getFirstHeaderValue(headers.get('x-forwarded-proto'));
  const protocol = forwardedProto || fallbackProtocol.replace(/:$/, '');

  return `${protocol}://${hostname}`;
}
