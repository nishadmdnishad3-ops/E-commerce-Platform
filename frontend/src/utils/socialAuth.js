const API_BASE = 'http://127.0.0.1:8000'
import { saveAuthData } from './auth'

export { saveAuthData }

const requestSocialLogin = async (provider, body, fallbackMessage) => {
  const response = await fetch(`${API_BASE}/api/accounts/${provider}-login/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.detail || fallbackMessage)
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
  await loadScript('https://accounts.google.com/gsi/client', 'google-oauth-script')

  if (!window.google?.accounts?.id) {
    throw new Error('Google login is not available right now.')
  }

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

  if (!clientId) {
    throw new Error('Google client ID is missing. Add VITE_GOOGLE_CLIENT_ID to frontend/.env.')
  }

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Google login failed. Please try again.'))
    }, 30000)

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => {
        clearTimeout(timeoutId)
        if (!response?.credential) {
          reject(new Error('Google login failed. Please try again.'))
          return
        }
        resolve(response.credential)
      },
      cancel_on_tap_outside: true,
    })

    window.google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        // This can happen when the Google prompt is suppressed by UX or browser policy.
        // We do not reject immediately here because the user may still complete the flow.
        return
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
