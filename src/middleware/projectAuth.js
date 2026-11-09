import {
  protect,
  authorize
} from "./auth.js";

export function projectAuth(req, res, next) {
  protect(req, res, () => {
    req.projectUser = {
      ...req.user,
      _id: req.user.id
    };

    next();
  });
}

export const projectAdminOnly = authorize("admin");