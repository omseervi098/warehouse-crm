import mongoose from 'mongoose';
import Item from '../models/item.js';
import Party from '../models/party.js';

interface QueryParams {
  page?: string;
  limit?: string;
  sort?: string;
  order?: string;
  filters?: any;
  rangeFilters?: any;
  search?: string;
}

interface QueryHandlerOptions {
  model: any;
  pipeline: any[];
  dateFields?: string[]; // 'createdAt' for Stock, 'enteredAt' for Transaction
}


export const buildFilterQuery = async (query: QueryParams, model: any, dateFields: string[] = ['createdAt']) => {
  const { filters, rangeFilters, search } = query;

  const filterFields = filters ? Object.keys(filters) : [];
  if (
    filterFields.length > 0 &&
    !model.getFilterableFields().some((field: string) => filterFields.includes(field))
  ) {
    throw new Error('Invalid filter fields');
  }

  let filterQuery: any = {};

  if (filterFields) {
    for (const filterField of filterFields) {
      const filterValue = filters[filterField] !== undefined ? filters[filterField] : null;
      if (mongoose.isValidObjectId(filterValue)) {
        filterQuery[filterField] = new mongoose.Types.ObjectId(filterValue);
      } else {
        if (typeof filterValue === 'string' && filterValue.toLowerCase() === 'true') {
          filterQuery[filterField] = true;
        } else if (typeof filterValue === 'string' && filterValue.toLowerCase() === 'false') {
          filterQuery[filterField] = false;
        } else {
          filterQuery[filterField] = filterValue;
        }
      }
    }
  }

  const rangeFilterFields = rangeFilters ? Object.keys(rangeFilters) : [];
  if (
    rangeFilterFields.length > 0 &&
    !model
      .getRangeFilterableFields()
      .some((field: string) => rangeFilterFields.includes(field))
  ) {
    for (const rangeFilterField of rangeFilterFields) {
      if (
        !rangeFilters[rangeFilterField] ||
        (!rangeFilters[rangeFilterField].from && !rangeFilters[rangeFilterField].to)
      ) {
        throw new Error(`Invalid range filter for ${rangeFilterField}`);
      }
    }
  }

  if (rangeFilterFields) {
    for (const rangeFilterField of rangeFilterFields) {
      const from = rangeFilters[rangeFilterField]['from'];
      const to = rangeFilters[rangeFilterField]['to'];

      if (dateFields.includes(rangeFilterField)) {
        const rangeFilterValueFrom = from ? new Date(from) : null;
        const rangeFilterValueTo = to ? new Date(to) : null;

        if (rangeFilterValueFrom && rangeFilterValueTo) {
          rangeFilterValueTo.setDate(rangeFilterValueTo.getDate() + 1);
          rangeFilterValueTo.setMilliseconds(rangeFilterValueTo.getMilliseconds() - 1);
          filterQuery[rangeFilterField] = {
            $gte: rangeFilterValueFrom,
            $lte: rangeFilterValueTo,
          };
        } else if (rangeFilterValueFrom) {
          filterQuery[rangeFilterField] = {
            $gte: rangeFilterValueFrom,
          };
        } else if (rangeFilterValueTo) {
          rangeFilterValueTo.setDate(rangeFilterValueTo.getDate() + 1);
          rangeFilterValueTo.setMilliseconds(rangeFilterValueTo.getMilliseconds() - 1);
          filterQuery[rangeFilterField] = {
            $lte: rangeFilterValueTo,
          };
        }
      } else {
        const rangeFilterValueFrom = from;
        const rangeFilterValueTo = to;

        if (rangeFilterValueFrom === undefined || rangeFilterValueTo === undefined) {
          throw new Error('Invalid range filter values');
        }

        filterQuery[rangeFilterField] = {
          $gte: rangeFilterValueFrom,
          $lte: rangeFilterValueTo,
        };
      }
    }
  }

  if (search && (search as string).trim()) {
    const searchTerms = (search as string).trim().split(/\s+/);
    const regexes = searchTerms.map(term => {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(escaped, 'i');
    });

    const searchableFields = typeof model.getSearchableFields === 'function' ? model.getSearchableFields() : [];
    
    // Each field must match ALL regexes to satisfy the field condition
    const orConditions: any[] = searchableFields.map((field: string) => ({
      $and: regexes.map(re => ({ [field]: re }))
    }));
    
    if (model.schema.path('item')) {
      const itemQuery = { $and: regexes.map(re => ({ name: re })) };
      const matchingItems = await Item.find(itemQuery).select('_id').lean();
      if (matchingItems.length > 0) {
        orConditions.push({ item: { $in: matchingItems.map((i: any) => i._id) } });
      }
    }
    
    if (model.schema.path('party')) {
      const partyQuery = { $and: regexes.map(re => ({ name: re })) };
      const matchingParties = await Party.find(partyQuery).select('_id').lean();
      if (matchingParties.length > 0) {
        orConditions.push({ party: { $in: matchingParties.map((p: any) => p._id) } });
      }
    }
    
    if (orConditions.length > 0) {
      filterQuery.$or = orConditions;
    } else {
      filterQuery.$or = [{ _id: null }];
    }
  }

  return filterQuery;
};

export const handleFilteredQuery = async (
  query: QueryParams,
  options: QueryHandlerOptions
) => {
  const { model, pipeline, dateFields = ['createdAt'] } = options;
  const { page, limit, sort, order } = query;

  const pageNum = Math.max(1, parseInt(page as string) || 1);
  const limitNum = Math.min(1000000, Math.max(1, parseInt(limit as string) || 10));
  const skip = (pageNum - 1) * limitNum;

  const sortField = (sort as string) || '_id';
  const sortOrder = order === 'desc' ? -1 : 1;

  if (sortField && model.schema.path(sortField.split('.')[0]) === undefined) {
    throw new Error('Invalid sort field');
  }

  const filterQuery = await buildFilterQuery(query, model, dateFields);

  const completePipeline = [
    { $match: filterQuery },
    ...pipeline,
    { $sort: { [sortField]: sortOrder } },
    { $skip: skip },
    { $limit: limitNum },
  ];
  const results = await model.aggregate(completePipeline).exec();
  const total = await model.countDocuments(filterQuery);
  return { results, page: pageNum, limit: limitNum, total };
};

