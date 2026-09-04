/**
 * modules/blog —— 组装（P3 blog_profile 域：/blog/*）。
 */
import { Router } from 'express';
import { blogProfileDao } from './blogProfile.dao.js';
import { BlogProfileService } from './blogProfile.service.js';
import { BlogProfileController } from './blogProfile.controller.js';
import { blogProfileRoutes } from './blogProfile.routes.js';

export function createBlogRouter(): Router {
    return blogProfileRoutes(new BlogProfileController(new BlogProfileService(blogProfileDao)));
}
