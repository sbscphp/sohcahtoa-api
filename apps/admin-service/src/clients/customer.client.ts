import axios, { AxiosInstance } from "axios";

export type CustomerSummary = {
  id: string;
  email?: string;
  fullName?: string;
  phoneNumber?: string;
  createdAt?: string;
  status?: string;
};

export type CustomerDetail = CustomerSummary & {
  kycStatus?: string;
  nationality?: string;
  address?: string;
  // add more fields when customer-service defines them
};

export class CustomerClient {
  private http: AxiosInstance;

  constructor() {
    const baseURL = process.env.CUSTOMER_SERVICE_URL || "http://localhost:3002";
    this.http = axios.create({ baseURL });
  }

  async listCustomers(params: { page: number; limit: number; q?: string }) {
    const res = await this.http.get("/api/customers/admin", { params });
    return res.data;
  }

  async getCustomerById(userId: string) {
    const res = await this.http.get(`/api/customers/admin/${userId}`);
    return res.data;
  }
}

export default new CustomerClient();
