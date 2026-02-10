import axios, { AxiosInstance, AxiosResponse } from "axios";

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
};

interface ListCustomersParams {
  page: number;
  limit: number;
  q?: string;
}

export class CustomerClient {
  private readonly http: AxiosInstance;

  constructor(
    baseURL: string = process.env.CUSTOMER_SERVICE_URL || "http://localhost:3002"
  ) {
    this.http = axios.create({
      baseURL: `${baseURL}/api/customers/admin`,
      timeout: 5000,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  async listCustomers(
    params: ListCustomersParams
  ): Promise<CustomerSummary[]> {
    const res: AxiosResponse<CustomerSummary[]> =
      await this.http.get("/", { params });
    return res.data;
  }

  async getCustomerById(
    userId: string
  ): Promise<CustomerDetail> {
    const res: AxiosResponse<CustomerDetail> =
      await this.http.get(`/${userId}`);
    return res.data;
  }
}

export const customerClient = new CustomerClient();
