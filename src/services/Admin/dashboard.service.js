const httpStatus = require('http-status');
const { Sequelize } = require('sequelize');

const { Book, User, Profile, UserAttachment, Genre, Chapter, Admin, Role, Department, AssignBookEditor, } = require('../../models');
const ApiError = require('../../utils/ApiError');
const { bookStatus, userStatusTypes } = require('../../config/types');
const { Op } = require("sequelize");


const getDashboardCounts = async () => {
    try {
        const THREE_DAYS_AGO = new Date(Date.now() - 25 * 24 * 60 * 60 * 1000);
        const baseFilter = { is_active: 1 };
        const [
            totalSubmitted,
            inProgress,
            completed,
            totalUsers
        ] = await Promise.all([
            Book.count({ where: baseFilter }),
            Book.count({ where: { ...baseFilter, status: bookStatus.in_editing } }),
            Book.count({ where: { ...baseFilter, status: bookStatus.completed } }),
            User.count({ where: { ...baseFilter, status: userStatusTypes.ACCEPTED } })
        ]);

        const userInclude = [
            {
                model: Profile,
                as: 'user_profile',
                attributes: [
                    'id', 'name', 'mobile', 'is_active',
                    'created_at', 'overall_ratings',
                    'no_of_user_rated', 'no_of_user_reviewed'
                ],
            },
            {
                model: UserAttachment,
                as: 'user_attachments',
                attributes: ['id', 'title', 'file_type', 'file_name', 'file_uri', 'role_id'],
                where: { title: 'Profile Image' },
                order: [['id', 'DESC']],
                limit: 1
            }
        ];

        const bookInclude = [
            {
                model: Genre,
                as: 'book_genre',
                attributes: ['id', 'title']
            },
            {
                model: User,
                as: 'book_user',
                attributes: ['id', 'email', 'role_id', 'status', 'is_active'],
                include: userInclude
            }
        ];

        const [
            recentInEditing,
            recentCompleted,
            recentUsers
        ] = await Promise.all([
            Book.findAll({
                where: {
                    is_active: 1,
                    status: bookStatus.in_editing,
                    updated_at: { [Op.gte]: THREE_DAYS_AGO }
                },
                include: bookInclude,
                order: [['updated_at', 'DESC']]
            }),
            Book.findAll({
                where: {
                    is_active: 1,
                    status: bookStatus.completed,
                    updated_at: { [Op.gte]: THREE_DAYS_AGO }
                },
                include: bookInclude,
                order: [['updated_at', 'DESC']]
            }),
            User.findAll({
                where: {
                    is_active: 1,
                    status: userStatusTypes.ACCEPTED,
                    updated_at: { [Op.gte]: THREE_DAYS_AGO },
                },
                attributes: ['id', 'email', 'role_id', 'status', 'is_active'],
                include: userInclude
            })
        ]);

        return {
            dashboard: {
                totalSubmitted: {
                    value: totalSubmitted,
                    change: '+12%',
                    period: 'from last month'
                },
                inProgress: {
                    value: inProgress,
                    change: '+5%',
                    period: 'from last week'
                },
                completed: {
                    value: completed,
                    change: '+23%',
                    period: 'from last month'
                },
                totalUsers: {
                    value: totalUsers,
                    change: '+8%',
                    period: 'from last month'
                },
                recentActivity: {
                    userRegistration: recentUsers,
                    manuscriptSubmited: recentInEditing,
                    bookCompleated: recentCompleted
                }
            }
        };

    } catch (error) {
        throw new ApiError(
            error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
            error.message
        );
    }
};



module.exports = {
    getDashboardCounts,
};