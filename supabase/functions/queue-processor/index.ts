// Background job processor for robust queue management using PGMQ
// This runs as a Supabase Edge Function to process jobs reliably

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface JobProcessorConfig {
  batchSize: number;
  maxProcessingTime: number; // milliseconds
  enableNotifications: boolean;
  enableQueueRecalc: boolean;
  visibilityTimeout: number; // seconds
  usePGMQ: boolean; // feature flag for PGMQ vs legacy job_queue
}

interface PGMQMessage {
  msg_id: number;
  read_ct: number;
  enqueued_at: string;
  vt: string;
  message: any;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get feature flag for PGMQ usage
    const { data: usePGMQFlag } = await supabaseClient.rpc("get_feature_flag", {
      p_flag_name: "use_pgmq_for_queue_recalc"
    });

    const config: JobProcessorConfig = {
      batchSize: 10,
      maxProcessingTime: 45000, // 45 seconds (Edge Functions have 60s limit)
      enableNotifications: true,
      enableQueueRecalc: true,
      visibilityTimeout: 30, // 30 seconds visibility timeout for PGMQ
      usePGMQ: usePGMQFlag || false, // Feature flag: use PGMQ instead of legacy job_queue
    };

    const startTime = Date.now();
    const results = {
      jobsProcessed: 0,
      notificationsProcessed: 0,
      errors: [] as string[],
      processingTime: 0,
      pgmqJobsProcessed: 0,
      pgmqNotificationsProcessed: 0,
    };

    // Process queue recalculation jobs
    if (
      config.enableQueueRecalc &&
      Date.now() - startTime < config.maxProcessingTime
    ) {
      if (config.usePGMQ) {
        // Use PGMQ for queue recalculation
        try {
          const { data: messages, error: readError } = await supabaseClient.rpc(
            "read_recalc_jobs",
            { 
              p_limit: config.batchSize, 
              p_vt_seconds: config.visibilityTimeout 
            }
          );

          if (readError) {
            results.errors.push(`PGMQ read error: ${readError.message}`);
          } else if (messages && messages.length > 0) {
            console.log(`Processing ${messages.length} queue recalculation jobs from PGMQ`);
            
            for (const message of messages as PGMQMessage[]) {
              try {
                const { clinic_doctor_id, service_day } = message.message;
                
                console.log(`QUEUE_RECALC_PROCESSING: doctor_id=${clinic_doctor_id}, service_day=${service_day}, msg_id=${message.msg_id}, timestamp=${new Date().toISOString()}`);
                
                // Call the transactional recalculation function
                const { data: recalcResult, error: recalcError } = await supabaseClient.rpc(
                  "recalculate_queue_tx",
                  {
                    p_clinic_doctor_id: clinic_doctor_id,
                    p_service_day: service_day
                  }
                );

                if (recalcError) {
                  console.error(`QUEUE_RECALC_FAILED: doctor_id=${clinic_doctor_id}, service_day=${service_day}, error=${recalcError.message}, msg_id=${message.msg_id}, timestamp=${new Date().toISOString()}`);
                  results.errors.push(`Queue recalculation failed for doctor ${clinic_doctor_id}: ${recalcError.message}`);
                  
                  // Archive the failed message for retry/dead letter handling
                  await supabaseClient.rpc("archive_recalc_job", { p_msg_id: message.msg_id });
                } else {
                  console.log(`QUEUE_RECALC_SUCCESS: doctor_id=${clinic_doctor_id}, service_day=${service_day}, result=${JSON.stringify(recalcResult)}, msg_id=${message.msg_id}, timestamp=${new Date().toISOString()}`);
                  results.pgmqJobsProcessed++;
                  
                  // Acknowledge the message
                  await supabaseClient.rpc("ack_recalc_job", { p_msg_id: message.msg_id });
                }
              } catch (error) {
                console.error(`QUEUE_RECALC_EXCEPTION: msg_id=${message.msg_id}, error=${error.message}, timestamp=${new Date().toISOString()}`);
                results.errors.push(`Message processing error: ${error.message}`);
                
                // Archive the failed message
                await supabaseClient.rpc("archive_recalc_job", { p_msg_id: message.msg_id });
              }
            }
          }
        } catch (error) {
          results.errors.push(`PGMQ processing exception: ${error.message}`);
        }
      } else {
        // Legacy job_queue processing (fallback)
        try {
          const { data: jobResult, error: jobError } = await supabaseClient.rpc(
            "process_job_queue",
            { p_batch_size: config.batchSize }
          );

          if (jobError) {
            results.errors.push(`Job processing error: ${jobError.message}`);
          } else {
            results.jobsProcessed = jobResult?.processed || 0;
          }
        } catch (error) {
          results.errors.push(`Job processing exception: ${error.message}`);
        }
      }
    }

    // Process notification queue
    if (
      config.enableNotifications &&
      Date.now() - startTime < config.maxProcessingTime
    ) {
      if (config.usePGMQ) {
        // Use PGMQ for notifications
        try {
          const { data: messages, error: readError } = await supabaseClient.rpc(
            "read_notification_jobs",
            { 
              p_limit: config.batchSize, 
              p_vt_seconds: config.visibilityTimeout 
            }
          );

          if (readError) {
            results.errors.push(`PGMQ notification read error: ${readError.message}`);
          } else if (messages && messages.length > 0) {
            console.log(`Processing ${messages.length} notification jobs from PGMQ`);
            
            for (const message of messages as PGMQMessage[]) {
              try {
                const notificationData = message.message;
                
                console.log(`Processing notification:`, notificationData);
                
                // Call the notification service
                const { data: notificationResult, error: notificationError } =
                  await supabaseClient.rpc("process_notification_queue", {
                    p_batch_size: 1,
                    p_notification_data: notificationData
                  });

                if (notificationError) {
                  console.error(`Notification processing failed:`, notificationError);
                  results.errors.push(`Notification processing failed: ${notificationError.message}`);
                  
                  // Archive the failed message
                  await supabaseClient.rpc("archive_notification_job", { p_msg_id: message.msg_id });
                } else {
                  console.log(`Notification processing successful:`, notificationResult);
                  results.pgmqNotificationsProcessed++;
                  
                  // Acknowledge the message
                  await supabaseClient.rpc("ack_notification_job", { p_msg_id: message.msg_id });
                }
              } catch (error) {
                console.error(`Error processing notification message ${message.msg_id}:`, error);
                results.errors.push(`Notification message processing error: ${error.message}`);
                
                // Archive the failed message
                await supabaseClient.rpc("archive_notification_job", { p_msg_id: message.msg_id });
              }
            }
          }
        } catch (error) {
          results.errors.push(`PGMQ notification processing exception: ${error.message}`);
        }
      } else {
        // Legacy notification processing (fallback)
        try {
          const { data: notificationResult, error: notificationError } =
            await supabaseClient.rpc("process_notification_queue", {
              p_batch_size: config.batchSize,
            });

          if (notificationError) {
            results.errors.push(
              `Notification processing error: ${notificationError.message}`
            );
          } else {
            results.notificationsProcessed = notificationResult?.processed || 0;
          }
        } catch (error) {
          results.errors.push(
            `Notification processing exception: ${error.message}`
          );
        }
      }
    }

    // Clean up old completed jobs (older than 7 days) - only for legacy job_queue
    if (!config.usePGMQ) {
      try {
        await supabaseClient
          .from("job_queue")
          .delete()
          .eq("status", "COMPLETED")
          .lt(
            "completed_at",
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
          );
      } catch (error) {
        results.errors.push(`Cleanup error: ${error.message}`);
      }
    }

    results.processingTime = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        results,
        config: {
          usePGMQ: config.usePGMQ,
          batchSize: config.batchSize,
          visibilityTimeout: config.visibilityTimeout,
          featureFlagValue: usePGMQFlag
        }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

// Health check endpoint
export async function healthCheck() {
  return new Response(
    JSON.stringify({
      status: "healthy",
      timestamp: new Date().toISOString(),
    }),
    {
      headers: { "Content-Type": "application/json" },
      status: 200,
    }
  );
}
