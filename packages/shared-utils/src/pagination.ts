
export interface PaginationOptions {
    page?: number;
    limit?: number;
}

export interface PaginationResult<T> {
    data: T[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

export const paginate = async <T>(
    model: any,
    args: any = {},
    options: PaginationOptions = {},
    transform?: (data: T[]) => any[]
): Promise<PaginationResult<T>> => {
    const page = Number(options.page) || 1;
    const limit = Number(options.limit) || 10;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
        model.findMany({
            ...args,
            skip,
            take: limit,
        }),
        model.count({ where: args.where }),
    ]);

    const finalData = transform ? transform(data) : data;

    return {
        data: finalData,
        meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    };
};
