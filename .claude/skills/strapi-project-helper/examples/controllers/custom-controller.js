/**
 * CUSTOM CONTROLLER EXAMPLES
 *
 * Bu dosya Strapi 5'te custom controller örneklerini içerir
 * Dosya konumu: src/api/{api-name}/controllers/{controller-name}.js
 */

const { createCoreController } = require('@strapi/strapi').factories;

// ============================================
// TEMEL CUSTOM CONTROLLER
// ============================================

// Örnek 1: Basic custom controller
module.exports = createCoreController('api::article.article', ({ strapi }) => ({
  // Custom action - Makaleyi publish et
  async publish(ctx) {
    const { id } = ctx.params;

    try {
      // Permission check
      if (!ctx.state.user) {
        return ctx.unauthorized('You must be logged in');
      }

      // Update article
      const article = await strapi.documents('api::article.article').update({
        documentId: id,
        data: {
          publishedAt: new Date(),
          status: 'published'
        }
      });

      // Send notification
      await strapi.service('api::notification.notification').sendEmail({
        to: article.author.email,
        subject: 'Article Published',
        body: `Your article "${article.title}" has been published!`
      });

      return ctx.send({
        data: article,
        message: 'Article published successfully'
      });
    } catch (err) {
      strapi.log.error('Publish error:', err);
      return ctx.internalServerError('Failed to publish article');
    }
  },

  // Custom action - Makaleyi unpublish et
  async unpublish(ctx) {
    const { id } = ctx.params;

    const article = await strapi.documents('api::article.article').update({
      documentId: id,
      data: {
        publishedAt: null,
        status: 'draft'
      }
    });

    return ctx.send({
      data: article,
      message: 'Article unpublished'
    });
  }
}));

// ============================================
// SEARCH CONTROLLER
// ============================================

// Örnek 2: Advanced search
module.exports = createCoreController('api::article.article', ({ strapi }) => ({
  async search(ctx) {
    const {
      query,
      category,
      tags,
      author,
      minViews,
      page = 1,
      pageSize = 25
    } = ctx.query;

    // Validate
    if (!query || query.length < 3) {
      return ctx.badRequest('Query must be at least 3 characters');
    }

    // Build filters
    const filters = { $and: [] };

    // Search in multiple fields
    filters.$and.push({
      $or: [
        { title: { $containsi: query } },
        { content: { $containsi: query } },
        { excerpt: { $containsi: query } }
      ]
    });

    // Category filter
    if (category) {
      filters.$and.push({
        category: {
          slug: { $eq: category }
        }
      });
    }

    // Tags filter
    if (tags) {
      const tagArray = tags.split(',');
      filters.$and.push({
        tags: {
          name: { $in: tagArray }
        }
      });
    }

    // Author filter
    if (author) {
      filters.$and.push({
        author: {
          documentId: { $eq: author }
        }
      });
    }

    // Views filter
    if (minViews) {
      filters.$and.push({
        views: { $gte: parseInt(minViews) }
      });
    }

    // Always filter published
    filters.$and.push({
      publishedAt: { $notNull: true }
    });

    try {
      // Execute search
      const articles = await strapi.documents('api::article.article').findMany({
        filters,
        populate: ['author', 'category', 'tags', 'coverImage'],
        sort: ['views:desc', 'publishedAt:desc'],
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize)
        }
      });

      // Get total count
      const total = await strapi.db.query('api::article.article').count({
        where: filters
      });

      return ctx.send({
        data: articles,
        meta: {
          query,
          total,
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          pageCount: Math.ceil(total / parseInt(pageSize))
        }
      });
    } catch (err) {
      strapi.log.error('Search error:', err);
      return ctx.internalServerError('Search failed');
    }
  }
}));

// ============================================
// BULK OPERATIONS
// ============================================

// Örnek 3: Bulk operations
module.exports = createCoreController('api::article.article', ({ strapi }) => ({
  // Toplu publish
  async bulkPublish(ctx) {
    const { ids } = ctx.request.body;

    // Validate
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return ctx.badRequest('ids array is required');
    }

    if (ids.length > 100) {
      return ctx.badRequest('Maximum 100 articles can be published at once');
    }

    try {
      const results = await Promise.all(
        ids.map(id =>
          strapi.documents('api::article.article').update({
            documentId: id,
            data: {
              publishedAt: new Date(),
              status: 'published'
            }
          })
        )
      );

      return ctx.send({
        data: results,
        meta: {
          published: results.length,
          failed: ids.length - results.length
        }
      });
    } catch (err) {
      return ctx.internalServerError('Bulk publish failed');
    }
  },

  // Toplu silme
  async bulkDelete(ctx) {
    const { ids } = ctx.request.body;

    if (!ids || !Array.isArray(ids)) {
      return ctx.badRequest('ids array is required');
    }

    try {
      for (const id of ids) {
        await strapi.documents('api::article.article').delete({
          documentId: id
        });
      }

      return ctx.send({
        message: `${ids.length} articles deleted successfully`
      });
    } catch (err) {
      return ctx.internalServerError('Bulk delete failed');
    }
  }
}));

// ============================================
// FILE UPLOAD CONTROLLER
// ============================================

// Örnek 4: File upload
module.exports = createCoreController('api::article.article', ({ strapi }) => ({
  async uploadCover(ctx) {
    const { id } = ctx.params;
    const { files } = ctx.request;

    // Validate
    if (!files || !files.cover) {
      return ctx.badRequest('Cover image is required');
    }

    const file = files.cover;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return ctx.badRequest('Only JPEG, PNG, and WebP images are allowed');
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return ctx.badRequest('File size must be less than 5MB');
    }

    try {
      // Get existing article
      const article = await strapi.documents('api::article.article').findOne({
        documentId: id,
        populate: ['coverImage']
      });

      if (!article) {
        return ctx.notFound('Article not found');
      }

      // Delete old cover if exists
      if (article.coverImage) {
        await strapi.plugins.upload.services.upload.remove({
          id: article.coverImage.id
        });
      }

      // Upload new cover
      const uploadedFiles = await strapi.plugins.upload.services.upload.upload({
        data: {
          refId: id,
          ref: 'api::article.article',
          field: 'coverImage'
        },
        files: file
      });

      // Update article
      const updatedArticle = await strapi.documents('api::article.article').update({
        documentId: id,
        data: {
          coverImage: uploadedFiles[0].id
        }
      });

      return ctx.send({
        data: updatedArticle,
        message: 'Cover image uploaded successfully'
      });
    } catch (err) {
      strapi.log.error('Upload error:', err);
      return ctx.internalServerError('Upload failed');
    }
  }
}));

// ============================================
// STATISTICS CONTROLLER
// ============================================

// Örnek 5: Statistics endpoint
module.exports = createCoreController('api::article.article', ({ strapi }) => ({
  async stats(ctx) {
    try {
      // Total articles
      const total = await strapi.db.query('api::article.article').count();

      // Published articles
      const published = await strapi.db.query('api::article.article').count({
        where: {
          publishedAt: { $notNull: true }
        }
      });

      // Draft articles
      const drafts = total - published;

      // Most viewed articles
      const mostViewed = await strapi.documents('api::article.article').findMany({
        filters: {
          publishedAt: { $notNull: true }
        },
        sort: ['views:desc'],
        pagination: { limit: 5 },
        populate: ['author']
      });

      // Articles by category
      const categories = await strapi.db.connection.raw(`
        SELECT c.name, COUNT(a.id) as count
        FROM categories c
        LEFT JOIN articles a ON a.category_id = c.id
        GROUP BY c.id, c.name
        ORDER BY count DESC
      `);

      // Recent activity (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const recentActivity = await strapi.db.query('api::article.article').count({
        where: {
          publishedAt: {
            $gte: sevenDaysAgo.toISOString()
          }
        }
      });

      return ctx.send({
        data: {
          total,
          published,
          drafts,
          mostViewed,
          articlesByCategory: categories[0],
          recentActivity
        }
      });
    } catch (err) {
      strapi.log.error('Stats error:', err);
      return ctx.internalServerError('Failed to get statistics');
    }
  }
}));

// ============================================
// DEFAULT ACTION OVERRIDE
// ============================================

// Örnek 6: Override default find
module.exports = createCoreController('api::article.article', ({ strapi }) => ({
  async find(ctx) {
    // Add default filters
    ctx.query = {
      ...ctx.query,
      filters: {
        ...ctx.query.filters,
        publishedAt: { $notNull: true }  // Sadece published
      }
    };

    // Call parent find
    const { data, meta } = await super.find(ctx);

    // Add custom fields
    const enrichedData = data.map(article => ({
      ...article,
      readTime: calculateReadTime(article.content),
      excerpt: article.content?.substring(0, 200) + '...'
    }));

    return {
      data: enrichedData,
      meta
    };
  },

  async findOne(ctx) {
    const { id } = ctx.params;

    // Increment view count
    await strapi.service('api::article.article').incrementViews(id);

    // Call parent findOne
    const response = await super.findOne(ctx);

    return response;
  },

  async create(ctx) {
    // Auto-assign author
    if (ctx.state.user) {
      ctx.request.body.data = {
        ...ctx.request.body.data,
        author: ctx.state.user.id
      };
    }

    // Call parent create
    const response = await super.create(ctx);

    // Send notification
    await strapi.service('api::notification.notification').notifyAdmins({
      message: `New article created: ${response.data.title}`
    });

    return response;
  },

  async update(ctx) {
    const { id } = ctx.params;

    // Permission check - only author can edit
    const article = await strapi.documents('api::article.article').findOne({
      documentId: id,
      populate: ['author']
    });

    if (article.author.id !== ctx.state.user.id && ctx.state.user.role.type !== 'admin') {
      return ctx.forbidden('You can only edit your own articles');
    }

    // Call parent update
    const response = await super.update(ctx);

    // Log change
    await strapi.service('api::audit-log.audit-log').create({
      action: 'update',
      entity: 'article',
      entityId: id,
      user: ctx.state.user.id,
      changes: ctx.request.body.data
    });

    return response;
  }
}));

// ============================================
// HELPER FUNCTIONS
// ============================================

function calculateReadTime(content) {
  if (!content) return 0;
  const wordsPerMinute = 200;
  const words = content.split(/\s+/).length;
  return Math.ceil(words / wordsPerMinute);
}

// ============================================
// ROUTES İÇİN NOTLAR
// ============================================

/**
 * Custom route tanımlamaları için:
 * src/api/article/routes/custom-article.js
 *
 * module.exports = {
 *   routes: [
 *     {
 *       method: 'PUT',
 *       path: '/articles/:id/publish',
 *       handler: 'article.publish'
 *     },
 *     {
 *       method: 'GET',
 *       path: '/articles/search',
 *       handler: 'article.search'
 *     },
 *     {
 *       method: 'POST',
 *       path: '/articles/bulk-publish',
 *       handler: 'article.bulkPublish'
 *     },
 *     {
 *       method: 'POST',
 *       path: '/articles/:id/upload-cover',
 *       handler: 'article.uploadCover'
 *     },
 *     {
 *       method: 'GET',
 *       path: '/articles/stats',
 *       handler: 'article.stats'
 *     }
 *   ]
 * };
 */

module.exports = {
  calculateReadTime
};
