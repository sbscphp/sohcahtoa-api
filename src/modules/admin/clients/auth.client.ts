import axios, { AxiosInstance, AxiosResponse } from "axios";

interface LoginDto {
    email: string;
    password: string;
}

interface ForgotPasswordDto {
    email: string;
}

interface ResetPasswordDto {
    token: string;
    password: string;
}

export class AuthClient {
    private readonly http: AxiosInstance;

    constructor(
        baseURL: string = process.env.AUTH_SERVICE_URL || "http://localhost:3002"
    ) {
        this.http = axios.create({
            baseURL: `${baseURL}/api/auth`,
            timeout: 50000,
            headers: {
                "Content-Type": "application/json",
            },
        });
    }

    async login(payload: LoginDto): Promise<any> {
        console.log(this.http.defaults.baseURL)
        const res: AxiosResponse = await this.http.post("/login", payload);
        return res.data;
    }

    async forgotPassword(payload: ForgotPasswordDto): Promise<any> {
        const res: AxiosResponse = await this.http.post("/forgot-password", payload);
        return res.data;
    }

    async resetPassword(payload: ResetPasswordDto): Promise<any> {
        const res: AxiosResponse = await this.http.post("/reset-password", payload);
        return res.data;
    }
}

export const authClient = new AuthClient();
