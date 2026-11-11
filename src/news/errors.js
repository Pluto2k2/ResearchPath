// Thrown when arXiv or OpenAlex fail; the route turns it into a 502 with this message.
export class UpstreamError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UpstreamError';
  }
}
