import { API_BASE_URL, saveAuthData } from './auth'

export { saveAuthData }

const requestSocialLogin = async (provider, body, fallbackMessage) => {
  let response
  try {
    response = await fetch(`${API_BASE_URL}/api/accounts/${provider}-login/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('Could not reach TechMart. Check your network connection and try again.')
  }

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message = data.detail || data.error || data.message
    throw new Error(Array.isArray(message) ? message.join(' ') : message || fallbackMessage)
  }

  saveAuthData(data)
  return data
}

export const loginWithGoogle = async (credential) => {
  return requestSocialLogin(
    'google',
    { credential },
    'Google login failed. Please try again.'
  )
}

export const loginWithApple = async (identityToken, user = {}) => {
  return requestSocialLogin(
    'apple',
    { identityToken, user },
    'Apple login failed. Please try again.'
  )
}

export const loadScript = (src, id) => {
  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[data-script-id="${id}"]`)

    if (existingScript) {
      if (existingScript.dataset.loaded === 'true') {
        resolve()
        return
      }

      existingScript.addEventListener('load', () => resolve(), { once: true })
      existingScript.addEventListener('error', () => reject(new Error('Social login script failed to load.')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.defer = true
    script.dataset.scriptId = id
    script.onload = () => {
      script.dataset.loaded = 'true'
      resolve()
    }
    script.onerror = () => {
      reject(new Error('Social login script failed to load.'))
    }
    document.head.appendChild(script)
  })
}

export const initializeGoogleLogin = async () => {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim()
  if (!clientId || clientId.includes('your-google-client-id')) {
    throw new Error('Google login is not configured. Set VITE_GOOGLE_CLIENT_ID in frontend/.env and restart Vite.')
  }

  try {
    await loadScript('https://accounts.google.com/gsi/client', 'google-oauth-script')
  } catch {
    throw new Error('Could not load Google sign-in. Check your network connection and try again.')
  }

  if (!window.google?.accounts?.id) {
    throw new Error('Google login is not available right now.')
  }

  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (callback, value) => {
      if (settled) return
      settled = true
      clearTimeout(timeoutId)
      callback(value)
    }
    const timeoutId = setTimeout(() => {
      finish(reject, new Error('Google sign-in timed out or was closed. Please try again.'))
    }, 60000)

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => {
        if (!response?.credential) {
          finish(reject, new Error('Google did not return a credential. Please try again.'))
          return
        }
        finish(resolve, response.credential)
      },
      cancel_on_tap_outside: true,
    })

    window.google.accounts.id.prompt((notification) => {
      if (settled) return
      if (notification.isNotDisplayed?.()) {
        const reason = notification.getNotDisplayedReason?.()
        finish(reject, new Error(reason
          ? `Google sign-in could not be displayed (${reason}). Check your OAuth origin configuration.`
          : 'Google sign-in could not be displayed. Check your OAuth origin configuration.'))
      } else if (notification.isSkippedMoment?.() || notification.isDismissedMoment?.()) {
        finish(reject, new Error('Google sign-in was closed. Please try again.'))
      }
    })
  })
}

export const initializeAppleLogin = async () => {
  await loadScript('https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js', 'apple-oauth-script')

  if (!window.AppleID?.auth) {
    throw new Error('Apple login is not available right now.')
  }

  const clientId = import.meta.env.VITE_APPLE_CLIENT_ID

  if (!clientId) {
    throw new Error('Apple client ID is missing. Add VITE_APPLE_CLIENT_ID to frontend/.env.')
  }

  return new Promise((resolve, reject) => {
    window.AppleID.auth.init({
      clientId,
      scope: 'name email',
      redirectURI: 'http://localhost:5173',
      state: 'techmart-apple-login',
      nonce: 'techmart-apple-nonce',
      usePopup: true,
      responseType: 'code id_token',
      responseMode: 'form_post',
      onSuccess: (response) => resolve(response),
      onFailure: () => reject(new Error('Apple login failed. Please try again.')),
    })

    window.AppleID.auth.signIn()
  })
}
