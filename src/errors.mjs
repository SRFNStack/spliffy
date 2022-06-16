export class HttpError extends Error {
  constructor (statusCode, statusMessage, body) {
    super()
    this.statusCode = statusCode
    this.statusMessage = statusMessage
    this.body = body
  }
}

export class BadRequestError extends HttpError {
  constructor (body) {
    super(400, 'Bad Request', body)
  }
}

export class UnauthorizedError extends HttpError {
  constructor (body) {
    super(401, 'Unauthorized', body)
  }
}

export class PaymentRequiredError extends HttpError {
  constructor (body) {
    super(402, 'Payment Required', body)
  }
}

export class ForbiddenError extends HttpError {
  constructor (body) {
    super(403, 'Forbidden', body)
  }
}

export class NotFoundError extends HttpError {
  constructor (body) {
    super(404, 'Not Found', body)
  }
}

export class MethodNotAllowedError extends HttpError {
  constructor (body) {
    super(405, 'Method Not Allowed', body)
  }
}

export class NotAcceptableError extends HttpError {
  constructor (body) {
    super(406, 'Not Acceptable', body)
  }
}

export class ProxyAuthenticationRequiredError extends HttpError {
  constructor (body) {
    super(407, 'Proxy Authentication Required', body)
  }
}

export class RequestTimeoutError extends HttpError {
  constructor (body) {
    super(408, 'Request Timeout', body)
  }
}

export class ConflictError extends HttpError {
  constructor (body) {
    super(409, 'Conflict', body)
  }
}

export class GoneError extends HttpError {
  constructor (body) {
    super(410, 'Gone', body)
  }
}

export class LengthRequiredError extends HttpError {
  constructor (body) {
    super(411, 'Length Required', body)
  }
}

export class PreconditionFailedError extends HttpError {
  constructor (body) {
    super(412, 'Precondition Failed', body)
  }
}

export class PayloadTooLargeError extends HttpError {
  constructor (body) {
    super(413, 'Payload Too Large', body)
  }
}

export class URITooLongError extends HttpError {
  constructor (body) {
    super(414, 'URI Too Long', body)
  }
}

export class UnsupportedMediaTypeError extends HttpError {
  constructor (body) {
    super(415, 'Unsupported Media Type', body)
  }
}

export class RangeNotSatisfiableError extends HttpError {
  constructor (body) {
    super(416, 'Bad Request', body)
  }
}

export class ExpectationFailedError extends HttpError {
  constructor (body) {
    super(417, 'Expectation Failed', body)
  }
}

export class ImATeapotError extends HttpError {
  constructor (body) {
    super(418, 'I can\'t brew coffee', body)
  }
}

export class EnhanceYourCalmError extends HttpError {
  constructor (body) {
    super(420, 'Enhance Your Calm', body)
  }
}

export class MisdirectedRequestError extends HttpError {
  constructor (body) {
    super(421, 'Misdirected Request', body)
  }
}

export class UnprocessableEntityError extends HttpError {
  constructor (body) {
    super(422, 'Unprocessable Entity', body)
  }
}

export class LockedError extends HttpError {
  constructor (body) {
    super(423, 'Locked', body)
  }
}

export class FailedDependencyError extends HttpError {
  constructor (body) {
    super(424, 'Failed Dependency', body)
  }
}

export class TooEarlyError extends HttpError {
  constructor (body) {
    super(425, 'Too Early', body)
  }
}

export class UpgradeRequiredError extends HttpError {
  constructor (body) {
    super(426, 'Upgrade Required', body)
  }
}

export class PreconditionRequiredError extends HttpError {
  constructor (body) {
    super(428, 'Precondition Required', body)
  }
}

export class TooManyRequestsError extends HttpError {
  constructor (body) {
    super(429, 'Too Many Requests', body)
  }
}

export class RequestHeaderFieldsTooLargeError extends HttpError {
  constructor (body) {
    super(431, 'Request Header Fields Too Large', body)
  }
}

export class UnavailableForLegalReasonsError extends HttpError {
  constructor (body) {
    super(451, 'Unavailable For Legal Reasons', body)
  }
}

export class InternalServerError extends HttpError {
  constructor (body) {
    super(500, 'Internal Server Error', body)
  }
}

export class NotImplementedError extends HttpError {
  constructor (body) {
    super(501, 'Not Implemented', body)
  }
}

export class BadGatewayError extends HttpError {
  constructor (body) {
    super(502, 'Bad Gateway', body)
  }
}

export class ServiceUnavailableError extends HttpError {
  constructor (body) {
    super(503, 'Service Unavailable', body)
  }
}

export class GatewayTimeoutError extends HttpError {
  constructor (body) {
    super(504, 'Gateway Timeout', body)
  }
}

export class HTTPVersionNotSupportedError extends HttpError {
  constructor (body) {
    super(505, 'HTTP Version Not Supported', body)
  }
}

export class VariantAlsoNegotiatesError extends HttpError {
  constructor (body) {
    super(506, 'Variant Also Negotiates', body)
  }
}

export class InsufficientStorageError extends HttpError {
  constructor (body) {
    super(507, 'Insufficient Storage', body)
  }
}

export class LoopDetectedError extends HttpError {
  constructor (body) {
    super(508, 'Loop Detected', body)
  }
}

export class NotExtendedError extends HttpError {
  constructor (body) {
    super(510, 'Not Extended', body)
  }
}

export class NetworkAuthenticationRequiredError extends HttpError {
  constructor (body) {
    super(511, 'Network Authentication Required', body)
  }
}
