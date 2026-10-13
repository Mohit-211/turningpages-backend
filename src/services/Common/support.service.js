/** @format */

const { status: httpStatus } = require("http-status");
const { Op } = require("sequelize");
const { Ticket, TicketMessage, User, Profile, Admin } = require("../../models");
const ApiError = require("../../utils/ApiError");
const config = require("../../config/config");

/* ================= CREATE TICKET ================= */
const createTicket = async (body) => {
  try {
    const { user, subject, description, priority } = body;

    if (!subject || !description) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Please provide required fields: subject, description",
      );
    }

    const ticketCode = `TCK-${Date.now()}`;

    const ticketObj = {
      ticket_code: ticketCode,
      user_id: user.id,
      subject,
      description,
      priority: priority || "medium",
    };

    const ticketDoc = await Ticket.create(ticketObj);
    if (!ticketDoc) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Failed to create ticket",
      );
    }

    return ticketDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

/* ================= UPDATE TICKET ================= */
const updateTicket = async (body) => {
  try {
    const { user, ticket_id, subject, description } = body;

    if (!ticket_id) {
      throw new ApiError(httpStatus.BAD_REQUEST, "ticket_id is required");
    }

    const ticketDoc = await Ticket.findOne({
      where: {
        id: ticket_id,
        user_id: user.id,
        is_active: 1,
      },
    });

    if (!ticketDoc) {
      throw new ApiError(httpStatus.NOT_FOUND, "Ticket not found");
    }

    const updateData = {};
    if (subject) updateData.subject = subject;
    if (description) updateData.description = description;

    await Ticket.update(updateData, { where: { id: ticket_id } });

    return await Ticket.findByPk(ticket_id);
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

/* ================= GET USER TICKETS ================= */
const getMyTickets = async (body) => {
  try {
    const { user } = body;

    const tickets = await Ticket.findAll({
      where: {
        user_id: user.id,
        is_active: 1,
      },
      order: [["created_at", "DESC"]],
    });

    return tickets;
  } catch (error) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, error.message);
  }
};

/* ================= GET TICKET BY ID ================= */
const getTicketById = async (body, params) => {
  try {
    const { user } = body;
    const { ticketId } = params;

    if (!ticketId) {
      throw new ApiError(httpStatus.BAD_REQUEST, "ticketId is required");
    }

    const ticket = await Ticket.findOne({
      where: {
        id: ticketId,
        is_active: 1,
      },
      include: [
        {
          model: TicketMessage,
          as: "ticket_messages",
          order: [["created_at", "ASC"]],
          required: false,
        },
        {
          model: Admin,
          as: "assigned_admin",
          required: false,
		  attributes: ["id", "role_id", "name", "email"],
        },
      ],
    });

    if (!ticket) {
      throw new ApiError(httpStatus.NOT_FOUND, "Ticket not found");
    }

    if (
      ticket.user_id !== user.id &&
      !["ADM", "SUP_ADM", "ENG"].includes(user.role_id)
    ) {
      throw new ApiError(httpStatus.FORBIDDEN, "Access denied");
    }

    return ticket;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

/* ================= ADD MESSAGE ================= */
const addMessage = async (body) => {
  try {
    const { user, ticket_id, message } = body;

    if (!ticket_id || !message) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "ticket_id and message are required",
      );
    }

    const ticket = await Ticket.findByPk(ticket_id);
    if (!ticket) {
      throw new ApiError(httpStatus.NOT_FOUND, "Ticket not found");
    }

    const msgDoc = await TicketMessage.create({
      ticket_id,
      sender_id: user.id,
      sender_role: user.role_id == config.USR_ROLE_ID ? "user" : "support",
      message,
    });

    if (ticket.status === "open") {
      ticket.status = "in_progress";
      await ticket.save();
    }

    return msgDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

/* ================= SEARCH TICKETS ================= */
const searchTickets = async (body) => {
  try {
    const { user, status, priority, keyword } = body;

    let where = { is_active: 1 };

    if (![Number(config.SUP_ADM_ROLE_ID)].includes(user.role_id)) {
      where.user_id = user.id;
    }

    if (status) where.status = status;
    if (priority) where.priority = priority;

    if (keyword && keyword.length >= 3) {
      where[Op.or] = [
        { subject: { [Op.like]: `%${keyword}%` } },
        { description: { [Op.like]: `%${keyword}%` } },
      ];
    }

    const tickets = await Ticket.findAll({
      where,
      order: [["created_at", "DESC"]],
    });

    if (!tickets.length) {
      throw new ApiError(httpStatus.NOT_FOUND, "No tickets found");
    }

    return tickets;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

/* ================= REMOVE TICKET ================= */
const removeTicket = async (body) => {
  try {
    const { user, ticket_id } = body;

    if (!ticket_id) {
      throw new ApiError(httpStatus.BAD_REQUEST, "ticket_id is required");
    }

    const ticket = await Ticket.findOne({
      where: { id: ticket_id, user_id: user.id },
    });

    if (!ticket) {
      throw new ApiError(httpStatus.NOT_FOUND, "Ticket not found");
    }

    await ticket.destroy();
    return "";
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

/* ================= ADMIN / SUPPORT ================= */

const getAllTickets = async () => {
  try {
    return await Ticket.findAll({
      where: { is_active: 1 },
      include: [
        {
          model: TicketMessage,
          as: "ticket_messages",
          // order: [["created_at", "ASC"]],
          required: false,
          separate: true,
        },
		 {
          model: Admin,
          as: "assigned_admin",
          required: false,
		  attributes: ["id", "role_id", "name", "email"],
        },
        {
          model: User,
          as: "ticket_user",
          attributes: ["id", "email"],
          include: [
            {
              model: Profile,
              as: "user_profile",
              attributes: ["name"],
            },
          ],
        },
      ],
      order: [["created_at", "DESC"]],
    });
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const assignTicket = async (body) => {
  try {
    const { user, ticket_id, assigned_to } = body;

    if (![Number(config.SUP_ADM_ROLE_ID)].includes(user.role_id)) {
      throw new ApiError(httpStatus.FORBIDDEN, "Access denied");
    }

    const ticket = await Ticket.findByPk(ticket_id);
    if (!ticket) throw new ApiError(httpStatus.NOT_FOUND, "Ticket not found");

    ticket.assigned_to = assigned_to;
    ticket.status = "in_progress";
    await ticket.save();

    return ticket;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const updateStatus = async (body) => {
  try {
    const { user, ticket_id, status } = body;

    if (
      !["open", "in_progress", "waiting_user", "resolved", "closed"].includes(
        status,
      )
    ) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid status");
    }

    const ticket = await Ticket.findByPk(ticket_id);
    if (!ticket) throw new ApiError(httpStatus.NOT_FOUND, "Ticket not found");

    ticket.status = status;
    await ticket.save();

    return ticket;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const updatePriority = async (body) => {
  try {
    const { ticket_id, priority } = body;

    const ticket = await Ticket.findByPk(ticket_id);
    if (!ticket) throw new ApiError(httpStatus.NOT_FOUND, "Ticket not found");

    ticket.priority = priority;
    await ticket.save();

    return ticket;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const addInternalNote = async (body) => {
  try {
    const { user, ticket_id, message } = body;

    if (![Number(config.SUP_ADM_ROLE_ID)].includes(user.role_id)) {
      throw new ApiError(httpStatus.FORBIDDEN, "Access denied");
    }

    return await TicketMessage.create({
      ticket_id,
      sender_id: user.id,
      sender_role: "admin",
      message,
      is_internal: true,
    });
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const closeTicket = async (body) => {
  const ticket = await Ticket.findByPk(body.ticket_id);
  ticket.status = "closed";
  await ticket.save();
  return ticket;
};

const reopenTicket = async (body) => {
  const ticket = await Ticket.findByPk(body.ticket_id);
  ticket.status = "open";
  await ticket.save();
  return ticket;
};

const updateTicketByAdmin = async (body) => {
  try {
    const { user, ticket_id, status, priority, assigned_to, note } = body;

    // ✅ FIND TICKET
    const ticket = await Ticket.findByPk(ticket_id);
    if (!ticket) {
      throw new ApiError(httpStatus.NOT_FOUND, "Ticket not found");
    }

    // ✅ STATUS VALIDATION
    const validStatus = [
      "open",
      "in_progress",
      "waiting_user",
      "resolved",
      "closed",
    ];

    if (status && !validStatus.includes(status)) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid status");
    }

    // ✅ PRIORITY VALIDATION
    const validPriority = ["low", "medium", "high", "urgent"];

    if (priority && !validPriority.includes(priority)) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid priority");
    }

    // ✅ UPDATE FIELDS (only if provided)
    if (status) ticket.status = status;
    if (priority) ticket.priority = priority;

    if (assigned_to !== undefined) {
      ticket.assigned_to = assigned_to;

      // auto move to in_progress if assigning
      if (assigned_to && ticket.status === "open") {
        ticket.status = "in_progress";
      }
    }

    await ticket.save();

    // ✅ ADD INTERNAL NOTE (optional)
    if (note) {
      await TicketMessage.create({
        ticket_id,
        sender_id: user.id,
        sender_role: "admin",
        message: note,
        is_internal: true,
      });
    }

    // ✅ RETURN UPDATED DATA
    const updatedTicket = await Ticket.findByPk(ticket_id, {
      include: [
        {
          model: TicketMessage,
          as: "ticket_messages",
          required: false,
        },
        {
          model: User,
          as: "ticket_user",
          attributes: ["id", "email"],
          include: [
            {
              model: Profile,
              as: "user_profile",
              attributes: ["name"],
            },
          ],
        },
      ],
    });

    return updatedTicket;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

module.exports = {
  createTicket,
  updateTicket,
  getMyTickets,
  getTicketById,
  addMessage,
  searchTickets,
  removeTicket,
  getAllTickets,
  assignTicket,
  updateStatus,
  updatePriority,
  addInternalNote,
  closeTicket,
  reopenTicket,
  updateTicketByAdmin,
};
