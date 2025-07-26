import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';
import { Company } from './models/company';
import { connectDB } from './services/db-service';
import { createCompanySchema, updateCompanySchema, addCustomerSchema } from './validation';

interface AuthorizerContext {
  userId?: string;
  userRole?: string;
  company_id?: string | null;
  associateCompanyIds?: string;
}

const createResponse = (statusCode: number, body: object): APIGatewayProxyResult => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  },
  body: JSON.stringify(body),
});

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Handle preflight OPTIONS requests
  if (event.httpMethod === 'OPTIONS') {
    return createResponse(200, {});
  }

  try {
    await connectDB();
    const { httpMethod, path, body, pathParameters, requestContext } = event;

    let parsedBody;
    try {
      parsedBody = body ? JSON.parse(body) : {};
    } catch (err) {
      return createResponse(400, { message: 'Invalid JSON body' });
    }

    const authorizer: AuthorizerContext = requestContext.authorizer || {};
    const userId = authorizer.userId;
    const userRole = authorizer.userRole;

    if (!userId) {
      return createResponse(403, { message: 'Unauthorized: User ID required' });
    }

    // POST /companies
    if (path === '/companies' && httpMethod === 'POST') {
      if (userRole !== 'company') {
        return createResponse(403, { message: 'Unauthorized: Company role required' });
      }
      const existingCompany = await Company.findOne({ userId });
      if (existingCompany) {
        return createResponse(400, { message: 'User can only create one company' });
      }
      const data = createCompanySchema.parse(parsedBody);
      const company = await Company.create({ ...data, userId });
      return createResponse(201, company);
    }

    // GET /companies
    if (path === '/companies' && httpMethod === 'GET') {
      let companies;
      if (userRole === 'admin') {
        companies = await Company.find({});
      } else if (userRole === 'company') {
        companies = await Company.find({ userId });
      } else if (userRole === 'customer') {
        let associateCompanyIds: string[] = [];
        try {
          associateCompanyIds = JSON.parse(authorizer.associateCompanyIds || '[]');
        } catch (err) {
          return createResponse(400, { message: 'Invalid associate company IDs' });
        }
        companies = await Company.find({ _id: { $in: associateCompanyIds } });
      } else {
        return createResponse(403, { message: 'Unauthorized: Invalid role' });
      }
      return createResponse(200, companies);
    }

    // GET /companies/{companyId}
    if (path.startsWith('/companies/') && httpMethod === 'GET' && pathParameters?.companyId) {
      const id = pathParameters.companyId;
      const company = await Company.findById(id);
      if (!company) {
        return createResponse(404, { message: 'Company not found' });
      }
      if (userRole === 'company' && company.userId !== userId) {
        return createResponse(403, { message: 'Unauthorized access to company' });
      }
      return createResponse(200, company);
    }

    // PUT /companies/{companyId}
    if (path.startsWith('/companies/') && httpMethod === 'PUT' && pathParameters?.companyId) {
      if (userRole !== 'company') {
        return createResponse(403, { message: 'Unauthorized: Company role required' });
      }
      const id = pathParameters.companyId;
      const company = await Company.findById(id);
      if (!company) {
        return createResponse(404, { message: 'Company not found' });
      }
      if (company.userId !== userId) {
        return createResponse(403, { message: 'Unauthorized access to company' });
      }
      const data = updateCompanySchema.parse(parsedBody);
      Object.assign(company, data);
      await company.save();
      return createResponse(200, company);
    }

    // DELETE /companies/{companyId}
    if (path.startsWith('/companies/') && httpMethod === 'DELETE' && pathParameters?.companyId) {
      if (userRole !== 'company') {
        return createResponse(403, { message: 'Unauthorized: Company role required' });
      }
      const id = pathParameters.companyId;
      const company = await Company.findById(id);
      if (!company) {
        return createResponse(404, { message: 'Company not found' });
      }
      if (company.userId !== userId) {
        return createResponse(403, { message: 'Unauthorized access to company' });
      }
      await Company.deleteOne({ _id: id });
      return createResponse(204, {});
    }

    // POST /companies/{companyId}/customers
    if (pathParameters?.companyId && httpMethod === 'POST' && path.endsWith('/customers')) {
      if (userRole !== 'company') {
        return createResponse(403, { message: 'Unauthorized: Company role required' });
      }
      const companyId = pathParameters.companyId;
      const company = await Company.findById(companyId);
      if (!company) {
        return createResponse(404, { message: 'Company not found' });
      }
      if (company.userId !== userId) {
        return createResponse(403, { message: 'Unauthorized access to company' });
      }
      const customerData = addCustomerSchema.parse(parsedBody);
      company.customers = company.customers || [];
      if (!company.customers.includes(customerData.customerId)) {
        company.customers.push(customerData.customerId);
        await company.save();
      }
      return createResponse(200, company);
    }

    // GET /companies/customers/{customerId}
    if (path.includes('/companies/customers/') && httpMethod === 'GET' && pathParameters?.customerId) {
      const customerId = pathParameters.customerId;
      const companies = await Company.find({ customers: customerId });
      return createResponse(200, companies);
    }

    // POST /companies/code
    if (path === '/companies/code' && httpMethod === 'POST') {
      const data = z.object({ code: z.string().min(1, 'Code is required') }).parse(parsedBody);
      const company = await Company.findOne({ companyCode: data.code });
      if (!company) {
        return createResponse(404, { message: 'Invalid company code' });
      }
      return createResponse(200, company);
    }

    // GET /companies/code/{code}
    if (path.startsWith('/companies/code/') && httpMethod === 'GET' && pathParameters?.code) {
      const code = pathParameters.code;
      const company = await Company.findOne({ companyCode: code });
      if (!company) {
        return createResponse(404, { message: 'Invalid company code' });
      }
      return createResponse(200, company);
    }

    // POST /companies/code/{code}/customers
    if (path.startsWith('/companies/code/') && path.includes('/customers') && httpMethod === 'POST' && pathParameters?.code) {
      const code = pathParameters.code;
      const company = await Company.findOne({ companyCode: code });
      if (!company) {
        return createResponse(404, { message: 'Invalid company code' });
      }
      if (!company.customers.includes(userId)) {
        company.customers.push(userId);
        await company.save();
      }
      return createResponse(200, company);
    }

    return createResponse(404, { message: 'Route not found' });
  } catch (err) {
    console.error('Handler error:', err);
    if (err instanceof z.ZodError) {
      return createResponse(400, { errors: err.errors });
    }
    if (err instanceof Error) {
      const statusCode = err.message.includes('not found') || err.message.includes('Invalid company code') ? 404 : err.message.includes('Unauthorized') ? 403 : 400;
      return createResponse(statusCode, { message: err.message });
    }
    return createResponse(500, { message: 'Internal server error' });
  }
};