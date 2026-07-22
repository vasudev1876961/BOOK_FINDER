const API_BASE_URL = "http://localhost:8000/api/v1";

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

class ApiClient {
  private static isRefreshing = false;
  private static refreshSubscribers: ((token: string) => void)[] = [];

  private static subscribeTokenRefresh(cb: (token: string) => void) {
    this.refreshSubscribers.push(cb);
  }

  private static onRefreshed(token: string) {
    this.refreshSubscribers.map((cb) => cb(token));
    this.refreshSubscribers = [];
  }

  private static getAccessToken(): string | null {
    return localStorage.getItem("access_token");
  }

  private static getRefreshToken(): string | null {
    return localStorage.getItem("refresh_token");
  }

  private static saveTokens(access: string, refresh: string) {
    localStorage.setItem("access_token", access);
    localStorage.setItem("refresh_token", refresh);
  }

  private static clearTokens() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    window.dispatchEvent(new Event("auth-logout"));
  }

  public static async request(endpoint: string, options: RequestOptions = {}): Promise<any> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    // Setup headers
    const headers = new Headers(options.headers || {});
    if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }

    // Append access token if not skipped
    if (!options.skipAuth) {
      const token = this.getAccessToken();
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
    }

    const config: RequestInit = {
      ...options,
      headers
    };

    try {
      const response = await fetch(url, config);

      // Handle successful responses
      if (response.ok) {
        if (response.status === 204) return null;
        return await response.json();
      }

      // Handle token expiration (401 Unauthorized)
      if (response.status === 401 && !options.skipAuth) {
        return await this.handle401Error(endpoint, options);
      }

      // Handle other error responses
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.detail || `Request failed with status ${response.status}`;
      throw new Error(errorMessage);
      
    } catch (error) {
      throw error;
    }
  }

  private static async handle401Error(endpoint: string, options: RequestOptions): Promise<any> {
    const refreshToken = this.getRefreshToken();
    
    if (!refreshToken) {
      this.clearTokens();
      throw new Error("Session expired. Please log in again.");
    }

    if (!this.isRefreshing) {
      this.isRefreshing = true;

      try {
        const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ refresh_token: refreshToken })
        });

        if (refreshResponse.ok) {
          const data = await refreshResponse.json();
          this.saveTokens(data.access_token, data.refresh_token);
          this.isRefreshing = false;
          this.onRefreshed(data.access_token);
        } else {
          this.isRefreshing = false;
          this.clearTokens();
          throw new Error("Session expired. Please log in again.");
        }
      } catch (err) {
        this.isRefreshing = false;
        this.clearTokens();
        throw err;
      }
    }

    // Wait for the token refresh to complete, then retry the request
    return new Promise((resolve) => {
      this.subscribeTokenRefresh((newToken) => {
        const headers = new Headers(options.headers || {});
        headers.set("Authorization", `Bearer ${newToken}`);
        if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
          headers.set("Content-Type", "application/json");
        }
        
        resolve(
          this.request(endpoint, {
            ...options,
            headers
          })
        );
      });
    });
  }

  // HTTP wrapper shortcuts
  public static get(endpoint: string, options: RequestOptions = {}) {
    return this.request(endpoint, { ...options, method: "GET" });
  }

  public static post(endpoint: string, body: any, options: RequestOptions = {}) {
    return this.request(endpoint, {
      ...options,
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body)
    });
  }

  public static put(endpoint: string, body: any, options: RequestOptions = {}) {
    return this.request(endpoint, {
      ...options,
      method: "PUT",
      body: JSON.stringify(body)
    });
  }

  public static delete(endpoint: string, options: RequestOptions = {}) {
    return this.request(endpoint, { ...options, method: "DELETE" });
  }
}

export default ApiClient;
export { API_BASE_URL };
