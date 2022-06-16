import {
  BadRequestError,
  EnhanceYourCalmError,
  InternalServerError,
  ServiceUnavailableError
} from '../../src/errors.mjs'

export default {
  GET: ({ url: { query } }) => {
    switch (query.statusCode) {
      case '400': throw new BadRequestError({ errors: ['big bad request'] })
      case '420': throw new EnhanceYourCalmError({ errors: ['chill out dude'] })
      case '503': throw new ServiceUnavailableError({ errors: ['not home right now'] })
      default: throw new InternalServerError({ errors: ['broke af'] })
    }
  }
}
