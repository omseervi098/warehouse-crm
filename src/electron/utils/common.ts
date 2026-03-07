// Common CRUD helpers for Mongoose models
export const getALL = async (model: any) => model.find();
export const getByID = async (model: any, id: string) => model.findById(id);
export const getByName = async (model: any, name: string) => model.findOne({ name });
export const updateByID = async (model: any, id: string, data: any, returnNew: boolean = true) =>
  model.findByIdAndUpdate(id, data, { new: returnNew });
export const deleteByID = async (model: any, id: string) => model.findByIdAndDelete(id);
export const create = async (model: any, data: any) => model.create(data);
