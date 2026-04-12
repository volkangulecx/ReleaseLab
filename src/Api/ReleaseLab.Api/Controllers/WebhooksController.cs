using Microsoft.AspNetCore.Mvc;
using ReleaseLab.Application.Interfaces;

namespace ReleaseLab.Api.Controllers;

[ApiController]
[Route("api/v1/webhooks")]
public class WebhooksController : ControllerBase
{
    private readonly IPaymentService _paymentService;
    private readonly ILogger<WebhooksController> _logger;

    public WebhooksController(IPaymentService paymentService, ILogger<WebhooksController> logger)
    {
        _paymentService = paymentService;
        _logger = logger;
    }

    [HttpPost("stripe")]
    public async Task<IActionResult> StripeWebhook()
    {
        var json = await new StreamReader(HttpContext.Request.Body).ReadToEndAsync();
        var signature = Request.Headers["Stripe-Signature"].ToString();

        try
        {
            await _paymentService.HandleWebhookAsync(json, signature);
            return Ok();
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Stripe webhook failed");
            return BadRequest(new { message = ex.Message });
        }
    }
}
