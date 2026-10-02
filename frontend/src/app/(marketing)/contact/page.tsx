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

  const onSubmit = async () => {
    toast.error('The contact form is not connected. Your message was not sent.');
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
      <main className="container mx-auto px-4 py-8 sm:py-12">
        <section aria-labelledby="contact-heading" className="text-center mb-12">
          <h1 id="contact-heading" className="mb-4 text-3xl font-bold sm:text-4xl">
            Get in Touch
          </h1>
          <p className="mx-auto max-w-2xl text-base text-muted-foreground sm:text-lg">
            We'd love to hear from you! Whether you have a question, feedback, or a partnership
            inquiry, please fill out the form below.
          </p>
        </section>

        <div className="mx-auto max-w-lg rounded-lg border border-border bg-card p-5 shadow-lg sm:p-8">
          <p role="status" className="mb-6 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
            This form is not connected yet. Submitting it will not deliver a message.
          </p>
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
