import {CloudFunction} from '../../utils/Registry/decorators';
import ResearchPosts from '../../models/ResearchPosts';
import ResearchCategories from '../../models/ResearchCategories';
import PostCategories from '../../models/PostCategories';

async function _getUser(req: Parse.Cloud.FunctionRequest) {
  if (req.user) return req.user;

  const sessionToken = (req as any).headers?.['x-parse-session-token'];
  if (!sessionToken) return null;

  const sessionQuery = new Parse.Query(Parse.Session);
  sessionQuery.equalTo('sessionToken', sessionToken);
  sessionQuery.include('user');
  const session = await sessionQuery.first({useMasterKey: true});
  return session?.get('user') || null;
}

class ResearchPostsFunctions {
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        title: {type: String, required: true},
        body: {type: String, required: true},
        category_name: {type: String, required: true},
        keywords: {type: String, required: false},
        document: {type: Object, required: false},
      },
    },
  })
  async submitResearchPost(req: Parse.Cloud.FunctionRequest) {
    const user = await _getUser(req);
    if (!user) throw {code: 141, message: 'User is not logged in'};

    const role = await user.get('role')?.fetch({useMasterKey: true});
    const allowedRoles = ['Doctor', 'Specialist'];
    if (!role || !allowedRoles.includes(role.get('name'))) {
      throw {
        code: 403,
        message: 'Only doctors or specialists can submit articles.',
      };
    }

    const {title, body, category_name, keywords, document} = req.params;

    const categoryQuery = new Parse.Query(ResearchCategories);
    categoryQuery.equalTo('name', category_name);
    const category = await categoryQuery.first({useMasterKey: true});

    const post = new ResearchPosts();
    post.set('title', title);
    post.set('body', body);
    post.set('status', 'pending');
    post.set('keywords', keywords || '');
    post.set('author_id', {
      __type: 'Pointer',
      className: '_User',
      objectId: user.id,
    });
    post.set('created_at', new Date());
    post.set('updated_at', new Date());

    if (document) {
      post.set('document', document);
    }

    await post.save(null, {useMasterKey: true});

    if (category) {
      const postCategory = new PostCategories();
      postCategory.set('post_id', post);
      postCategory.set('category_id', category);
      await postCategory.save(null, {useMasterKey: true});
    }

    return {
      message: category
        ? 'The article has been submitted and linked to the existing category.'
        : 'The article has been submitted. The category does not exist and will be reviewed by the admin.',
      post_id: post.id,
    };
  }
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
    },
  })
  async getPendingResearchPosts(req: Parse.Cloud.FunctionRequest) {
    const user = await _getUser(req);
    if (!user) throw {code: 141, message: 'User is not logged in'};

    const role = await user.get('role')?.fetch({useMasterKey: true});
    if (!role || role.get('name') !== 'Admin') {
      throw {code: 403, message: 'Only admins can view pending articles.'};
    }

    const query = new Parse.Query(ResearchPosts);
    query.equalTo('status', 'pending');
    query.include('author_id');
    query.descending('created_at');
    const posts = await query.find({useMasterKey: true});

    const results = [];

    for (const post of posts) {
      const postId = post.id;

      const postCategoryQuery = new Parse.Query(PostCategories);
      postCategoryQuery.equalTo('post_id', post);
      postCategoryQuery.include('category_id');
      const postCategory = await postCategoryQuery.first({useMasterKey: true});

      results.push({
        post_id: postId,
        title: post.get('title'),
        body: post.get('body'),
        keywords: post.get('keywords'),
        created_at: post.get('created_at'),
        author: {
          id: post.get('author_id')?.id,
          name: post.get('author_id')?.get('fullName') || 'Unknown',
        },
        category: postCategory?.get('category_id')?.get('name') || 'undefined',
        has_document: !!post.get('document'),
      });
    }

    return results;
  }

  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        post_id: {type: String, required: true},
        action: {type: String, required: true},
        rejection_reason: {type: String, required: false},
      },
    },
  })
  async approveOrRejectPost(req: Parse.Cloud.FunctionRequest) {
    const user = await _getUser(req);
    if (!user) throw {code: 141, message: 'User is not logged in'};

    const role = await user.get('role')?.fetch({useMasterKey: true});
    if (!role || role.get('name') !== 'Admin') {
      throw {code: 403, message: 'Only admins can approve or reject articles.'};
    }

    const {post_id, action, rejection_reason} = req.params;

    const postQuery = new Parse.Query(ResearchPosts);
    const post = await postQuery.get(post_id, {useMasterKey: true});

    if (!post) throw {code: 404, message: 'Article not found.'};

    if (action === 'publish') {
      post.set('status', 'published');
      post.set('updated_at', new Date());
    } else if (action === 'reject') {
      post.set('status', 'rejected');
      post.set('rejection_reason', rejection_reason || 'No reason provided');
      post.set('updated_at', new Date());
    } else {
      throw {code: 400, message: 'Invalid action. Use "publish" or "reject".'};
    }

    await post.save(null, {useMasterKey: true});

    return {
      message: `The article has been ${
        action === 'publish' ? 'published' : 'rejected'
      } successfully.`,
      post_id: post.id,
      status: post.get('status'),
    };
  }
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
    },
  })
  async getPublishedResearchPosts(req: Parse.Cloud.FunctionRequest) {
    const query = new Parse.Query(ResearchPosts);
    query.equalTo('status', 'published');
    query.descending('created_at');
    query.include('author_id');
    const posts = await query.find({useMasterKey: true});

    const results = [];

    for (const post of posts) {
      const postId = post.id;

      const postCategoryQuery = new Parse.Query(PostCategories);
      postCategoryQuery.equalTo('post_id', post);
      postCategoryQuery.include('category_id');
      const postCategory = await postCategoryQuery.first({useMasterKey: true});

      results.push({
        post_id: postId,
        title: post.get('title'),
        body: post.get('body'),
        keywords: post.get('keywords'),
        created_at: post.get('created_at'),
        author: {
          id: post.get('author_id')?.id,
          name:
            post.get('author_id')?.get('fullName') ||
            post.get('author_id')?.get('username') ||
            'Unknown',
        },
        category: postCategory?.get('category_id')?.get('name') || 'undefined',
        document_url: post.get('document')?.url() || null,
      });
    }

    return results;
  }

  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        query: {type: String, required: true},
      },
    },
  })
  async searchResearchPosts(req: Parse.Cloud.FunctionRequest) {
    const {query} = req.params;

    const postQuery = new Parse.Query(ResearchPosts);
    postQuery.equalTo('status', 'published');
    postQuery.matches('keywords', new RegExp(query, 'i'));
    postQuery.include('author_id');
    postQuery.descending('created_at');
    const posts = await postQuery.find({useMasterKey: true});

    const results = [];

    for (const post of posts) {
      const postId = post.id;

      const postCategoryQuery = new Parse.Query(PostCategories);
      postCategoryQuery.equalTo('post_id', post);
      postCategoryQuery.include('category_id');
      const postCategory = await postCategoryQuery.first({useMasterKey: true});

      results.push({
        post_id: postId,
        title: post.get('title'),
        body: post.get('body'),
        keywords: post.get('keywords'),
        created_at: post.get('created_at'),
        author: {
          id: post.get('author_id')?.id,
          name:
            post.get('author_id')?.get('fullName') ||
            post.get('author_id')?.get('username') ||
            'Unknown',
        },
        category: postCategory?.get('category_id')?.get('name') || null,
        document_url: post.get('document')?.url() || null,
      });
    }

    return results;
  }

  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
    },
  })
  async getMyResearchPosts(req: Parse.Cloud.FunctionRequest) {
    const user = await _getUser(req);
    if (!user) throw {code: 141, message: 'User is not logged in'};

    const query = new Parse.Query(ResearchPosts);
    query.equalTo('author_id', {
      __type: 'Pointer',
      className: '_User',
      objectId: user.id,
    });
    query.descending('created_at');
    const posts = await query.find({useMasterKey: true});

    const results = [];

    for (const post of posts) {
      const postId = post.id;

      const postCategoryQuery = new Parse.Query(PostCategories);
      postCategoryQuery.equalTo('post_id', post);
      postCategoryQuery.include('category_id');
      const postCategory = await postCategoryQuery.first({useMasterKey: true});

      results.push({
        post_id: postId,
        title: post.get('title'),
        body: post.get('body'),
        status: post.get('status'),
        keywords: post.get('keywords'),
        created_at: post.get('created_at'),
        category: postCategory?.get('category_id')?.get('name') || 'undefined',
        document_url: post.get('document')?.url() || null,
        rejection_reason: post.get('rejection_reason') || null,
      });
    }

    return results;
  }
}
export default new ResearchPostsFunctions();
