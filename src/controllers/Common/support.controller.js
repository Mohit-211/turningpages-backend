const httpStatus = require('http-status');
const catchAsync = require('../../utils/catchAsync');
const { supportService } = require('../../services/Common');
const responseWrapper = require('../../config/responseWrapper');
const pick = require('../../utils/pick');

/* ================= CREATE TICKET ================= */
const createTicket = catchAsync(async (req, res) => {
    const body = pick(req.body, [
        'subject',
        'description',
        'priority',
        'user'
    ]);

    const ticket = await supportService.createTicket(body);
    return responseWrapper(
        res,
        ticket,
        'Ticket created successfully',
        httpStatus.CREATED
    );
});

/* ================= UPDATE TICKET ================= */
const updateTicket = catchAsync(async (req, res) => {
    const body = pick(req.body, [
        'ticket_id',
        'subject',
        'description',
        'user'
    ]);

    const ticket = await supportService.updateTicket(body);
    return responseWrapper(res, ticket, 'Ticket updated successfully');
});

/* ================= GET USER TICKETS ================= */
const getMyTickets = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const tickets = await supportService.getMyTickets(body);
    return responseWrapper(res, tickets);
});

/* ================= GET TICKET BY ID ================= */
const getTicketById = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const params = pick(req.params, ['ticketId']);

    const ticket = await supportService.getTicketById(body, params);
    return responseWrapper(res, ticket);
});

/* ================= ADD MESSAGE ================= */
const addMessage = catchAsync(async (req, res) => {
    const body = pick(req.body, [
        'ticket_id',
        'message',
        'user'
    ]);

    const msg = await supportService.addMessage(body);
    return responseWrapper(res, msg, 'Message added successfully');
});

/* ================= SEARCH TICKETS ================= */
const searchTickets = catchAsync(async (req, res) => {
    const body = pick(req.body, [
        'user',
        'status',
        'priority',
        'keyword'
    ]);

    const tickets = await supportService.searchTickets(body);
    return responseWrapper(res, tickets);
});

/* ================= REMOVE TICKET ================= */
const removeTicket = catchAsync(async (req, res) => {
    const body = pick(req.body, [
        'user',
        'ticket_id'
    ]);

    await supportService.removeTicket(body);
    return responseWrapper(res, '', 'Ticket deleted successfully');
});

/* ================= ADMIN / SUPPORT ================= */

/* Get all tickets */
const getAllTickets = catchAsync(async (req, res) => {
    const tickets = await supportService.getAllTickets();
    return responseWrapper(res, tickets);
});

/* Assign ticket */
const assignTicket = catchAsync(async (req, res) => {
    const body = pick(req.body, [
        'ticket_id',
        'assigned_to',
        'user'
    ]);

    const ticket = await supportService.assignTicket(body);
    return responseWrapper(res, ticket, 'Ticket assigned successfully');
});

/* Update ticket status */
const updateStatus = catchAsync(async (req, res) => {
    const body = pick(req.body, [
        'ticket_id',
        'status',
        'user'
    ]);

    const ticket = await supportService.updateStatus(body);
    return responseWrapper(res, ticket, 'Ticket status updated');
});

/* Update priority */
const updatePriority = catchAsync(async (req, res) => {
    const body = pick(req.body, [
        'ticket_id',
        'priority',
        'user'
    ]);

    const ticket = await supportService.updatePriority(body);
    return responseWrapper(res, ticket, 'Ticket priority updated');
});

/* Add internal note */
const addInternalNote = catchAsync(async (req, res) => {
    const body = pick(req.body, [
        'ticket_id',
        'message',
        'user'
    ]);

    const note = await supportService.addInternalNote(body);
    return responseWrapper(res, note, 'Internal note added');
});

/* Close ticket */
const closeTicket = catchAsync(async (req, res) => {
    const body = pick(req.body, [
        'ticket_id',
        'user'
    ]);

    const ticket = await supportService.closeTicket(body);
    return responseWrapper(res, ticket, 'Ticket closed successfully');
});

/* Reopen ticket */
const reopenTicket = catchAsync(async (req, res) => {
    const body = pick(req.body, [
        'ticket_id',
        'user'
    ]);

    const ticket = await supportService.reopenTicket(body);
    return responseWrapper(res, ticket, 'Ticket reopened successfully');
});

const updateTicketByAdmin = catchAsync(async (req, res) => {
  
    const ticket = await supportService.updateTicketByAdmin(req.body);
    return responseWrapper(res, ticket, 'Ticket updated successfully');
});

module.exports = {
    createTicket,
    updateTicket,
    getMyTickets,
    getTicketById,
    addMessage,
    searchTickets,
    removeTicket,

    /* admin/support */
    getAllTickets,
    assignTicket,
    updateStatus,
    updatePriority,
    addInternalNote,
    closeTicket,
    reopenTicket,
    updateTicketByAdmin
};
