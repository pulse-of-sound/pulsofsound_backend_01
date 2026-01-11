import {CloudFunction} from '../../utils/Registry/decorators';
import Level from '../../models/Level';
class LevelFunctions {
//إضافة مستوى من قبل الأدمن
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        name: {required: true, type: String},
        description: {required: false, type: String},
        order: {required: true, type: Number},
      },
    },
  })
  async addLevelByAdmin(req: Parse.Cloud.FunctionRequest) {
    try {
      const {name, description, order} = req.params;

      const existing = await new Parse.Query(Level)
        .equalTo('order', order)
        .first({useMasterKey: true});

      if (existing) {
        throw {
          codeStatus: 101,
          message: 'Level with this order already exists',
        };
      }

      const level = new Level();
      level.set('name', name);
      level.set('description', description || '');
      level.set('order', order);
      level.set('created_at', new Date());
      level.set('updated_at', new Date());

      await level.save(null, {useMasterKey: true});

      return {
        message: 'Level added successfully',
        level: level.toJSON(),
      };
    } catch (error: any) {
      console.error('Error in addLevelByAdmin:', error);
      throw {
        codeStatus: error.codeStatus || 1000,
        message: error.message || 'Failed to add level',
      };
    }
  }
//جلب كل المستويات
  @CloudFunction({
    methods: ['GET', 'POST'],
    validation: {
      requireUser: false,
      fields: {},
    },
  })
  async getAllLevels(req: Parse.Cloud.FunctionRequest) {
    const query = new Parse.Query(Level);
    query.ascending('order');

    const results = await query.find({useMasterKey: true});

    const levels = results.map(level => ({
      objectId: level.id,
      name: level.get('name'),
      description: level.get('description'),
      order: level.get('order'),
    }));

    return {
      message: 'All levels fetched successfully',
      levels,
    };
  }
//جلب المستوى عن طريق id
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        level_id: {required: true, type: String},
      },
    },
  })
  async getLevelById(req: Parse.Cloud.FunctionRequest) {
    const {level_id} = req.params;

    const level = await new Parse.Query(Level)
      .equalTo('objectId', level_id)
      .first({useMasterKey: true});

    if (!level) {
      throw {
        codeStatus: 404,
        message: 'Level not found',
      };
    }

    return {
      message: 'Level fetched successfully',
      level: level.toJSON(),
    };
  }
//حذف مستوى
  @CloudFunction({
    methods: ['POST'],
    validation: {
      requireUser: false,
      fields: {
        level_id: {required: true, type: String},
      },
    },
  })
  async deleteLevel(req: Parse.Cloud.FunctionRequest) {
    const {level_id} = req.params;

    const level = await new Parse.Query(Level)
      .equalTo('objectId', level_id)
      .first({useMasterKey: true});

    if (!level) {
      throw {
        codeStatus: 404,
        message: 'Level not found',
      };
    }

    await level.destroy({useMasterKey: true});

    return {
      message: 'Level deleted successfully',
      deleted_id: level_id,
    };
  }
}

export default new LevelFunctions();
