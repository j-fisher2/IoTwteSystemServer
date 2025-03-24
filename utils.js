import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

const accountSid = process.env.TWILIO_ACCOUNT_SID; 
const authToken = process.env.TWILIO_AUTH_TOKEN; 
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

const client = twilio(accountSid, authToken);

export async function sendSMSNotification(message, userPhoneNumber) {
    try {
        const sms = await client.messages.create({
            body: message,                 
            from: twilioPhoneNumber,      
            to: userPhoneNumber         
        });

        console.log(`SMS sent successfully to ${userPhoneNumber}: ${sms.sid}`);
        return { success: true, sid: sms.sid };
    } catch (error) {
        console.error(`Failed to send SMS: ${error.message}`);
        return { success: false, error: error.message };
    }
}
