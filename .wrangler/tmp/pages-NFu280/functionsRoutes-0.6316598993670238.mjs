import { onRequestPost as __api_login_js_onRequestPost } from "C:\\Users\\izumi\\othellonia-tournament-site\\functions\\api\\login.js"
import { onRequestPost as __api_logout_js_onRequestPost } from "C:\\Users\\izumi\\othellonia-tournament-site\\functions\\api\\logout.js"
import { onRequestGet as __api_me_js_onRequestGet } from "C:\\Users\\izumi\\othellonia-tournament-site\\functions\\api\\me.js"

export const routes = [
    {
      routePath: "/api/login",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_login_js_onRequestPost],
    },
  {
      routePath: "/api/logout",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_logout_js_onRequestPost],
    },
  {
      routePath: "/api/me",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_me_js_onRequestGet],
    },
  ]