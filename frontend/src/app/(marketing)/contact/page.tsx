'use client';

import React from 'react';
import Head from 'next/head';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/shared/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { toast } from 'react-hot-toast';

const formSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Invalid email address.' }),
  message: z.string().min(10, { message: 'Message must be at least 10 characters.' }),
});

type ContactFormValues = z.infer<typeof formSchema>;

export default function ContactPage() {
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      message: '',
    },
  });

  const onSubmit = async (values: ContactFormValues) => {
    // In a real application, you would send this data to your backend or a service like EmailJS
    console.warn(values);
    toast.success('Your message has been sent!');
    form.reset();

    // Example EmailJS integration (requires EmailJS to be set up)
    /*
    try {
      await emailjs.send(
        'YOUR_SERVICE_ID',
        'YOUR_TEMPLATE_ID',
        {
          from_name: values.name,
          from_email: values.email,
          message: values.message,
        },
        'YOUR_USER_ID'
      );
      toast.success('Your message has been sent!');
      form.reset();
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message. Please try again later.');
    }
    */
  };

  return (
    <>
      <Head>
        <title>Contact MedTrack Hub - Get in Touch</title>
        <meta
          name="description"
          content="Have questions or feedback? Contact MedTrack Hub for support, inquiries, or partnership opportunities."
        />
        <meta property="og:title" content="Contact MedTrack Hub - Get in Touch" />
        <meta
          property="og:description"
          content="Have questions or feedback? Contact MedTrack Hub for support, inquiries, or partnership opportunities."
        />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/og-image.png" />
      </Head>
      <main className="container mx-auto py-12 px-4">
        <section aria-labelledby="contact-heading" className="text-center mb-12">
          <h1 id="contact-heading" className="text-4xl font-bold mb-4">
            Get in Touch
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            We'd love to hear from you! Whether you have a question, feedback, or a partnership
            inquiry, please fill out the form below.
          </p>
        </section>

        <div className="max-w-lg mx-auto bg-card p-8 rounded-lg shadow-lg border border-border">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your Name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="your@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Your message..." rows={5} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full">
                Send Message
              </Button>
            </form>
          </Form>
        </div>
      </main>
    </>
  );
}
