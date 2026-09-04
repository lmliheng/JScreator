/**
 * modules/article —— 组装（P3 article 域：文章/分类/归档/AI 总结）。
 */
import { Router } from 'express';
import { articleDao } from './article.dao.js';
import { loadAiSummaryUtils, loadTokenValidator } from '../../legacy.js';
import { ArticleService, type ArticleDeps } from './article.service.js';
import { ArticleController, type ArticleControllerDeps } from './article.controller.js';
import { articleRoutes } from './article.routes.js';

export function createArticleRouter(): Router {
    const deps: ArticleDeps = {
        dao: articleDao,
        summarizeAndSave: (articleId, input) => loadAiSummaryUtils().summarizeAndSave(articleId, input),
    };
    const ctrlDeps: ArticleControllerDeps = {
        resolveToken: (token) => {
            const decoded = loadTokenValidator()(token);
            if (decoded && typeof decoded === 'object' && (decoded as { id?: unknown }).id !== undefined) {
                return { id: (decoded as { id: number | string }).id };
            }
            return null;
        },
    };
    return articleRoutes(new ArticleController(new ArticleService(deps), ctrlDeps));
}
