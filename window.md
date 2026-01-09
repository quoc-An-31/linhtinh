Dưới đây là bản đã được format lại chuẩn Markdown, **đã khôi phục các ký tự tiếng Việt bị lỗi** (như `đ`, `ê`, `ư`, `ơ`...) và sửa lại định dạng tiền tệ (`₫`) trong code.

Bạn có thể copy toàn bộ nội dung bên dưới vào file `.md` (ví dụ: `Member1_Sprint1.md`).

---

# 🚀 MEMBER 1 - ROADMAP & IMPLEMENTATION TUTORIAL

## 📋 Tổng quan

Bạn là **Member 1** - phụ trách **AUTH + DASHBOARD MODULE**. Tài liệu này sẽ hướng dẫn từng bước implement chi tiết.

### Trạng thái hiện tại của codebase:

* 🔹 Project structure đã tạo
* 🔹 Models đã có (Profile, Product, Order, etc.)
* 🔹 Interfaces đã định nghĩa
* 🔹 Views placeholder đã có
* ⬜ Services chưa implement
* ⬜ ViewModels chưa implement
* ⬜ DI Container chưa setup
* ⬜ UI chưa có nội dung

---

# 🏁 SPRINT 1: FOUNDATION

## 🎯 Mục tiêu Sprint 1

1. ✅ DI Container hoạt động
2. ✅ Supabase connection thành công
3. ✅ Login flow hoàn chỉnh
4. ✅ Navigation giữa các pages
5. ✅ Shell layout với menu

---

# 🛠 TASK 1.1: DI CONTAINER SETUP ⏱ [3h]

## Mục tiêu

Setup Dependency Injection container để quản lý services và viewmodels.

## File cần sửa: `Win_Shop/App.xaml.cs`

### Step 1: Thêm using statements

```csharp
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Win_Shop.Services;
using Win_Shop.Services.Interfaces;
using Win_Shop.ViewModels;
using Win_Shop.ViewModels.Base;
using Win_Shop.Views;

```

### Step 2: Implement App.xaml.cs hoàn chỉnh

```csharp
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Microsoft.UI.Xaml;
using Win_Shop.Services;
using Win_Shop.Services.Interfaces;
using Win_Shop.ViewModels;
using Win_Shop.Views;
using System.IO;
using System.Reflection;

namespace Win_Shop;

public partial class App : Application
{
    private Window? _window;
    
    /// <summary>
    /// Gets the current App instance
    /// </summary>
    public static new App Current => (App)Application.Current;
    
    /// <summary>
    /// Gets the IServiceProvider instance
    /// </summary>
    public IServiceProvider Services { get; }
    
    /// <summary>
    /// Gets the IConfiguration instance
    /// </summary>
    public IConfiguration Configuration { get; }

    public App()
    {
        InitializeComponent();
        
        // Load configuration
        Configuration = LoadConfiguration();
        
        // Setup DI
        Services = ConfigureServices();
    }

    /// <summary>
    /// Load configuration from appsettings.json
    /// </summary>
    private static IConfiguration LoadConfiguration()
    {
        var assembly = Assembly.GetExecutingAssembly();
        var assemblyLocation = Path.GetDirectoryName(assembly.Location) ?? "";
        
        return new ConfigurationBuilder()
            .SetBasePath(assemblyLocation)
            .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
            .Build();
    }

    /// <summary>
    /// Configure all services for DI
    /// </summary>
    private IServiceProvider ConfigureServices()
    {
        var services = new ServiceCollection();
        
        // Register Configuration
        services.AddSingleton(Configuration);
        
        // Register Supabase Service (Singleton - one connection for entire app)
        services.AddSingleton<SupabaseService>();
        
        // Register Services (Transient - new instance each time)
        services.AddTransient<IAuthService, AuthService>();
        services.AddTransient<INavigationService, NavigationService>();
        services.AddTransient<IProductService, ProductService>();
        services.AddTransient<ICategoryService, CategoryService>();
        services.AddTransient<IOrderService, OrderService>();
        services.AddTransient<ICustomerService, CustomerService>();
        services.AddTransient<ICouponService, CouponService>();
        services.AddTransient<IPrintService, PrintService>();
        services.AddTransient<IBackupService, BackupService>();
        
        // Register ViewModels (Transient)
        services.AddTransient<LoginViewModel>();
        services.AddTransient<ShellViewModel>();
        services.AddTransient<DashboardViewModel>();
        services.AddTransient<ProductViewModel>();
        services.AddTransient<OrderViewModel>();
        services.AddTransient<CustomerViewModel>();
        services.AddTransient<CouponViewModel>();
        services.AddTransient<SettingsViewModel>();
        
        return services.BuildServiceProvider();
    }

    /// <summary>
    /// Get service from DI container
    /// </summary>
    public static T GetService<T>() where T : class
    {
        return Current.Services.GetRequiredService<T>();
    }

    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        _window = new MainWindow();
        _window.Activate();
    }
    
    /// <summary>
    /// Gets the main window
    /// </summary>
    public Window? MainWindow => _window;
}

```

### Step 3: Test DI Container

Sau khi implement, bạn có thể test bằng cách thêm code này vào MainWindow:

```csharp
// Test DI
var authService = App.GetService<IAuthService>();
System.Diagnostics.Debug.WriteLine($"AuthService resolved: {authService != null}");

```

### ✅ Checklist Task 1.1

* [ ] Thêm using statements
* [ ] Implement ConfigureServices()
* [ ] Implement LoadConfiguration()
* [ ] Implement GetService<T>() helper
* [ ] Test resolve service thành công
* [ ] Build không lỗi

---

# 🔌 TASK 1.2: SUPABASE SERVICE ⏱ [2h]

## Mục tiêu

Tạo Supabase client singleton để các services khác sử dụng.

## File cần sửa: `Win_Shop/Services/SupabaseService.cs`

### Implement hoàn chỉnh

```csharp
using Microsoft.Extensions.Configuration;
using Supabase;
using Client = Supabase.Client;

namespace Win_Shop.Services;

/// <summary>
/// Singleton Supabase client service
/// </summary>
public class SupabaseService
{
    private readonly Client _client;
    private readonly string _supabaseUrl;
    private readonly string _supabaseKey;
    private bool _isInitialized = false;

    /// <summary>
    /// Gets the Supabase client instance
    /// </summary>
    public Client Client => _client;

    /// <summary>
    /// Check if service is initialized
    /// </summary>
    public bool IsInitialized => _isInitialized;

    public SupabaseService(IConfiguration configuration)
    {
        _supabaseUrl = configuration["Supabase:Url"] 
            ?? throw new ArgumentNullException("Supabase:Url not found in configuration");
        _supabaseKey = configuration["Supabase:Key"] 
            ?? throw new ArgumentNullException("Supabase:Key not found in configuration");

        var options = new SupabaseOptions
        {
            AutoRefreshToken = true,
            AutoConnectRealtime = true
        };

        _client = new Client(_supabaseUrl, _supabaseKey, options);
    }

    /// <summary>
    /// Initialize the Supabase client (call once at app startup)
    /// </summary>
    public async Task InitializeAsync()
    {
        if (_isInitialized) return;

        try
        {
            await _client.InitializeAsync();
            _isInitialized = true;
            System.Diagnostics.Debug.WriteLine("Supabase initialized successfully");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Supabase initialization failed: {ex.Message}");
            throw;
        }
    }

    /// <summary>
    /// Test connection to Supabase
    /// </summary>
    public async Task<bool> TestConnectionAsync()
    {
        try
        {
            if (!_isInitialized)
            {
                await InitializeAsync();
            }

            // Try to query profiles table (should exist)
            var response = await _client
                .From<Models.Profile>()
                .Select("id")
                .Limit(1)
                .Get();

            return response != null;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Connection test failed: {ex.Message}");
            return false;
        }
    }

    /// <summary>
    /// Gets the Auth client for authentication operations
    /// </summary>
    public Supabase.Gotrue.Client Auth => _client.Auth;

    /// <summary>
    /// Gets the Storage client for file operations
    /// </summary>
    public Supabase.Storage.Client Storage => _client.Storage;

    /// <summary>
    /// Gets the Realtime client for subscriptions
    /// </summary>
    public Supabase.Realtime.Client Realtime => _client.Realtime;
}

```

### ✅ Checklist Task 1.2

* [ ] Đọc config từ appsettings.json
* [ ] Initialize Supabase Client
* [ ] Implement TestConnectionAsync()
* [ ] Expose Auth, Storage, Realtime clients
* [ ] Test connection thành công

---

# 🧠 TASK 1.3: VIEWMODEL BASE ⏱ [1h]

## Mục tiêu

Tạo base class với common properties và methods cho tất cả ViewModels.

## File cần sửa: `Win_Shop/ViewModels/Base/ViewModelBase.cs`

### Implement hoàn chỉnh

```csharp
using CommunityToolkit.Mvvm.ComponentModel;

namespace Win_Shop.ViewModels.Base;

/// <summary>
/// Base class for all ViewModels
/// </summary>
public abstract partial class ViewModelBase : ObservableObject
{
    [ObservableProperty]
    private bool _isLoading;

    [ObservableProperty]
    private string? _errorMessage;

    [ObservableProperty]
    private bool _hasError;

    /// <summary>
    /// Set error message and hasError flag
    /// </summary>
    protected void SetError(string message)
    {
        ErrorMessage = message;
        HasError = true;
    }

    /// <summary>
    /// Clear error message and hasError flag
    /// </summary>
    protected void ClearError()
    {
        ErrorMessage = null;
        HasError = false;
    }

    /// <summary>
    /// Called when navigating to this page
    /// </summary>
    public virtual Task OnNavigatedToAsync(object? parameter = null)
    {
        return Task.CompletedTask;
    }

    /// <summary>
    /// Called when navigating away from this page
    /// </summary>
    public virtual Task OnNavigatedFromAsync()
    {
        return Task.CompletedTask;
    }

    /// <summary>
    /// Execute async operation with loading state
    /// </summary>
    protected async Task ExecuteAsync(Func<Task> operation, string? errorPrefix = null)
    {
        try
        {
            ClearError();
            IsLoading = true;
            await operation();
        }
        catch (Exception ex)
        {
            var message = errorPrefix != null 
                ? $"{errorPrefix}: {ex.Message}" 
                : ex.Message;
            SetError(message);
            System.Diagnostics.Debug.WriteLine($"Error: {message}");
        }
        finally
        {
            IsLoading = false;
        }
    }

    /// <summary>
    /// Execute async operation with loading state and return result
    /// </summary>
    protected async Task<T?> ExecuteAsync<T>(Func<Task<T>> operation, string? errorPrefix = null)
    {
        try
        {
            ClearError();
            IsLoading = true;
            return await operation();
        }
        catch (Exception ex)
        {
            var message = errorPrefix != null 
                ? $"{errorPrefix}: {ex.Message}" 
                : ex.Message;
            SetError(message);
            System.Diagnostics.Debug.WriteLine($"Error: {message}");
            return default;
        }
        finally
        {
            IsLoading = false;
        }
    }
}

```

### ✅ Checklist Task 1.3

* [ ] Thêm HasError property
* [ ] Implement SetError() method
* [ ] Implement ClearError() method
* [ ] Implement OnNavigatedToAsync()
* [ ] Implement OnNavigatedFromAsync()
* [ ] Implement ExecuteAsync() helper

---

# 🔐 TASK 1.4: AUTH SERVICE ⏱ [4h]

## Mục tiêu

Implement authentication với Supabase Auth và Windows Credential Locker.

## File cần sửa: `Win_Shop/Services/AuthService.cs`

### Implement hoàn chỉnh

```csharp
using Win_Shop.Models;
using Win_Shop.Services.Interfaces;
using Win_Shop.Helpers;
using Windows.Security.Credentials;
using Supabase.Gotrue;
using Supabase.Gotrue.Exceptions;

namespace Win_Shop.Services;

/// <summary>
/// Authentication service implementation using Supabase Auth
/// </summary>
public class AuthService : IAuthService
{
    private readonly SupabaseService _supabase;
    private Profile? _currentUser;
    
    private const string CredentialResourceName = "Win_Shop_Credentials";

    public AuthService(SupabaseService supabase)
    {
        _supabase = supabase;
    }

    /// <inheritdoc/>
    public Profile? CurrentUser => _currentUser;

    /// <inheritdoc/>
    public bool IsAuthenticated => _currentUser != null;

    /// <inheritdoc/>
    public async Task<(bool Success, string? Error)> SignInAsync(string email, string password)
    {
        try
        {
            // Ensure Supabase is initialized
            if (!_supabase.IsInitialized)
            {
                await _supabase.InitializeAsync();
            }

            // Sign in with Supabase Auth
            var session = await _supabase.Auth.SignIn(email, password);

            if (session?.User == null)
            {
                return (false, "Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.");
            }

            // Get user profile from database
            var profile = await GetProfileAsync(session.User.Id);

            if (profile == null)
            {
                return (false, "Không tìm thấy thông tin người dùng.");
            }

            _currentUser = profile;
            return (true, null);
        }
        catch (GotrueException ex)
        {
            var errorMessage = ex.Message switch
            {
                var m when m.Contains("Invalid login credentials") => 
                    "Email hoặc mật khẩu không đúng.",
                var m when m.Contains("Email not confirmed") => 
                    "Email chưa được xác nhận.",
                _ => $"Lỗi đăng nhập: {ex.Message}"
            };
            return (false, errorMessage);
        }
        catch (Exception ex)
        {
            return (false, $"Lỗi kết nối: {ex.Message}");
        }
    }

    /// <inheritdoc/>
    public async Task SignOutAsync()
    {
        try
        {
            await _supabase.Auth.SignOut();
            _currentUser = null;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Sign out error: {ex.Message}");
        }
    }

    /// <inheritdoc/>
    public async Task<bool> TryRestoreSessionAsync()
    {
        try
        {
            // Try to get saved credentials
            var (email, password) = GetSavedCredentials();
            
            if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(password))
            {
                return false;
            }

            var (success, _) = await SignInAsync(email, password);
            return success;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Restore session error: {ex.Message}");
            return false;
        }
    }

    /// <inheritdoc/>
    public Task SaveCredentialsAsync(string email, string password)
    {
        try
        {
            var vault = new PasswordVault();
            
            // Remove existing credentials if any
            try
            {
                var existing = vault.FindAllByResource(CredentialResourceName);
                foreach (var cred in existing)
                {
                    vault.Remove(cred);
                }
            }
            catch { /* No existing credentials */ }

            // Save new credentials
            var credential = new PasswordCredential(CredentialResourceName, email, password);
            vault.Add(credential);
            
            System.Diagnostics.Debug.WriteLine("Credentials saved successfully");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Save credentials error: {ex.Message}");
        }

        return Task.CompletedTask;
    }

    /// <inheritdoc/>
    public Task ClearCredentialsAsync()
    {
        try
        {
            var vault = new PasswordVault();
            var credentials = vault.FindAllByResource(CredentialResourceName);
            
            foreach (var cred in credentials)
            {
                vault.Remove(cred);
            }
            
            System.Diagnostics.Debug.WriteLine("Credentials cleared");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Clear credentials error: {ex.Message}");
        }

        return Task.CompletedTask;
    }

    /// <summary>
    /// Get saved credentials from Windows Credential Locker
    /// </summary>
    private (string? Email, string? Password) GetSavedCredentials()
    {
        try
        {
            var vault = new PasswordVault();
            var credentials = vault.FindAllByResource(CredentialResourceName);
            
            if (credentials.Count > 0)
            {
                var cred = credentials[0];
                cred.RetrievePassword();
                return (cred.UserName, cred.Password);
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Get credentials error: {ex.Message}");
        }

        return (null, null);
    }

    /// <summary>
    /// Get user profile from database
    /// </summary>
    private async Task<Profile?> GetProfileAsync(string userId)
    {
        try
        {
            var response = await _supabase.Client
                .From<Profile>()
                .Where(p => p.Id == Guid.Parse(userId))
                .Single();

            return response;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Get profile error: {ex.Message}");
            return null;
        }
    }
}

```

### Cập nhật Model Profile

Cần thêm attribute cho Supabase trong `Models/Profile.cs`:

```csharp
using Newtonsoft.Json;
using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace Win_Shop.Models;

/// <summary>
/// User profile linked to Supabase auth.users
/// </summary>
[Table("profiles")]
public class Profile : BaseModel
{
    [PrimaryKey("id", false)]
    [JsonProperty("id")]
    public Guid Id { get; set; }

    [JsonProperty("email")]
    public string Email { get; set; } = string.Empty;

    [JsonProperty("full_name")]
    public string? FullName { get; set; }

    [JsonProperty("avatar_url")]
    public string? AvatarUrl { get; set; }

    [JsonProperty("role")]
    public string Role { get; set; } = "sale";

    [JsonProperty("phone")]
    public string? Phone { get; set; }

    [JsonProperty("created_at")]
    public DateTime CreatedAt { get; set; }

    [JsonProperty("updated_at")]
    public DateTime UpdatedAt { get; set; }

    public bool IsAdmin => Role == "admin";
}

```

### ✅ Checklist Task 1.4

* [ ] Implement SignInAsync với Supabase Auth
* [ ] Implement SignOutAsync
* [ ] Implement Windows Credential Locker
* [ ] Implement TryRestoreSessionAsync
* [ ] Update Profile model với Supabase attributes
* [ ] Test login thành công

---

# 👤 TASK 1.5: LOGIN VIEW MODEL ⏱ [2h]

## Mục tiêu

Implement ViewModel cho Login page với validation và commands.

## File cần sửa: `Win_Shop/ViewModels/LoginViewModel.cs`

### Implement hoàn chỉnh

```csharp
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Win_Shop.Services.Interfaces;
using Win_Shop.ViewModels.Base;

namespace Win_Shop.ViewModels;

/// <summary>
/// Login page ViewModel
/// </summary>
public partial class LoginViewModel : ViewModelBase
{
    private readonly IAuthService _authService;
    private readonly INavigationService _navigationService;

    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(LoginCommand))]
    private string _email = string.Empty;

    [ObservableProperty]
    [NotifyCanExecuteChangedFor(nameof(LoginCommand))]
    private string _password = string.Empty;

    [ObservableProperty]
    private bool _rememberMe = true;

    [ObservableProperty]
    private bool _isPasswordVisible;

    public LoginViewModel(IAuthService authService, INavigationService navigationService)
    {
        _authService = authService;
        _navigationService = navigationService;
    }

    /// <summary>
    /// Check if login can execute
    /// </summary>
    private bool CanLogin => 
        !string.IsNullOrWhiteSpace(Email) && 
        !string.IsNullOrWhiteSpace(Password) && 
        !IsLoading;

    /// <summary>
    /// Login command
    /// </summary>
    [RelayCommand(CanExecute = nameof(CanLogin))]
    private async Task LoginAsync()
    {
        await ExecuteAsync(async () =>
        {
            var (success, error) = await _authService.SignInAsync(Email, Password);

            if (success)
            {
                // Save credentials if Remember Me is checked
                if (RememberMe)
                {
                    await _authService.SaveCredentialsAsync(Email, Password);
                }
                else
                {
                    await _authService.ClearCredentialsAsync();
                }

                // Navigate to Shell/Dashboard
                _navigationService.NavigateTo<Views.ShellPage>();
            }
            else
            {
                SetError(error ?? "Đăng nhập thất bại");
            }
        }, "Đăng nhập thất bại");
    }

    /// <summary>
    /// Toggle password visibility
    /// </summary>
    [RelayCommand]
    private void TogglePasswordVisibility()
    {
        IsPasswordVisible = !IsPasswordVisible;
    }

    /// <summary>
    /// Try auto login on page load
    /// </summary>
    public override async Task OnNavigatedToAsync(object? parameter = null)
    {
        await ExecuteAsync(async () =>
        {
            var restored = await _authService.TryRestoreSessionAsync();
            if (restored)
            {
                _navigationService.NavigateTo<Views.ShellPage>();
            }
        });
    }
}

```

### ✅ Checklist Task 1.5

* [ ] Email, Password với ObservableProperty
* [ ] RememberMe property
* [ ] LoginCommand với CanExecute
* [ ] Validation (email & password required)
* [ ] Auto-login với saved credentials
* [ ] Navigate to Shell on success

---

# 🧭 TASK 1.6: NAVIGATION SERVICE ⏱ [2h]

## Mục tiêu

Implement navigation service để điều hướng giữa các pages.

## File cần sửa: `Win_Shop/Services/Interfaces/INavigationService.cs`

```csharp
using Microsoft.UI.Xaml.Controls;

namespace Win_Shop.Services.Interfaces;

/// <summary>
/// Navigation service interface
/// </summary>
public interface INavigationService
{
    /// <summary>
    /// Navigate to a page
    /// </summary>
    void NavigateTo<T>(object? parameter = null) where T : Page;

    /// <summary>
    /// Navigate to a page by type
    /// </summary>
    void NavigateTo(Type pageType, object? parameter = null);

    /// <summary>
    /// Navigate back
    /// </summary>
    void GoBack();

    /// <summary>
    /// Check if can go back
    /// </summary>
    bool CanGoBack { get; }

    /// <summary>
    /// Register the frame for navigation
    /// </summary>
    void RegisterFrame(Frame frame);

    /// <summary>
    /// Set the root frame (for switching between Login and Shell)
    /// </summary>
    void SetRootContent(object content);
}

```

## File cần sửa: `Win_Shop/Services/NavigationService.cs`

```csharp
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Win_Shop.Services.Interfaces;

namespace Win_Shop.Services;

/// <summary>
/// Navigation service implementation
/// </summary>
public class NavigationService : INavigationService
{
    private Frame? _frame;
    
    /// <inheritdoc/>
    public bool CanGoBack => _frame?.CanGoBack ?? false;

    /// <inheritdoc/>
    public void RegisterFrame(Frame frame)
    {
        _frame = frame;
    }

    /// <inheritdoc/>
    public void NavigateTo<T>(object? parameter = null) where T : Page
    {
        NavigateTo(typeof(T), parameter);
    }

    /// <inheritdoc/>
    public void NavigateTo(Type pageType, object? parameter = null)
    {
        if (_frame == null)
        {
            System.Diagnostics.Debug.WriteLine("Navigation frame not registered");
            return;
        }

        _frame.Navigate(pageType, parameter);
    }

    /// <inheritdoc/>
    public void GoBack()
    {
        if (_frame?.CanGoBack == true)
        {
            _frame.GoBack();
        }
    }

    /// <inheritdoc/>
    public void SetRootContent(object content)
    {
        var window = App.Current.MainWindow;
        if (window != null && window.Content is Frame rootFrame)
        {
            // For switching between Login and Shell
            if (content is Type pageType)
            {
                rootFrame.Navigate(pageType);
            }
        }
    }
}

```

### ✅ Checklist Task 1.6

* [ ] Implement NavigateTo<T>
* [ ] Implement NavigateTo(Type)
* [ ] Implement GoBack
* [ ] Implement RegisterFrame
* [ ] Implement SetRootContent
* [ ] Test navigation

---

# 🔄 TASK 1.7: CONVERTERS ⏱ [3.5h]

## Files cần sửa: `Win_Shop/Helpers/Converters/`

### BoolToVisibilityConverter.cs

```csharp
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Data;

namespace Win_Shop.Helpers.Converters;

/// <summary>
/// Converts boolean to Visibility
/// </summary>
public class BoolToVisibilityConverter : IValueConverter
{
    /// <summary>
    /// Set to true to invert the conversion
    /// </summary>
    public bool Invert { get; set; }

    public object Convert(object value, Type targetType, object parameter, string language)
    {
        var boolValue = value is bool b && b;
        
        // Check if parameter requests inversion
        if (parameter is string p && p.ToLower() == "invert")
        {
            boolValue = !boolValue;
        }
        
        if (Invert)
        {
            boolValue = !boolValue;
        }
        
        return boolValue ? Visibility.Visible : Visibility.Collapsed;
    }

    public object ConvertBack(object value, Type targetType, object parameter, string language)
    {
        var visibility = value is Visibility v && v == Visibility.Visible;
        return Invert ? !visibility : visibility;
    }
}

```

### CurrencyConverter.cs

```csharp
using Microsoft.UI.Xaml.Data;
using System.Globalization;

namespace Win_Shop.Helpers.Converters;

/// <summary>
/// Formats decimal as Vietnamese currency (VND)
/// </summary>
public class CurrencyConverter : IValueConverter
{
    private static readonly CultureInfo VietnamCulture = new("vi-VN");

    public object Convert(object value, Type targetType, object parameter, string language)
    {
        if (value == null) return "0 ₫";

        decimal amount = value switch
        {
            decimal d => d,
            double dbl => (decimal)dbl,
            int i => i,
            long l => l,
            float f => (decimal)f,
            string s when decimal.TryParse(s, out var parsed) => parsed,
            _ => 0
        };

        // Format: 1,234,567 ₫
        return $"{amount:N0} ₫";
    }

    public object ConvertBack(object value, Type targetType, object parameter, string language)
    {
        if (value is string str)
        {
            // Remove currency symbol and spaces
            var cleaned = str.Replace("₫", "").Replace(",", "").Replace(".", "").Trim();
            if (decimal.TryParse(cleaned, out var result))
            {
                return result;
            }
        }
        return 0m;
    }
}

```

### DateTimeConverter.cs

```csharp
using Microsoft.UI.Xaml.Data;

namespace Win_Shop.Helpers.Converters;

/// <summary>
/// Formats DateTime for display
/// </summary>
public class DateTimeConverter : IValueConverter
{
    /// <summary>
    /// Default format pattern
    /// </summary>
    public string Format { get; set; } = "dd/MM/yyyy HH:mm";

    public object Convert(object value, Type targetType, object parameter, string language)
    {
        if (value == null) return string.Empty;

        // Use parameter as format if provided
        var format = parameter as string ?? Format;

        return value switch
        {
            DateTime dt => dt.ToString(format),
            DateTimeOffset dto => dto.ToString(format),
            _ => value.ToString() ?? string.Empty
        };
    }

    public object ConvertBack(object value, Type targetType, object parameter, string language)
    {
        if (value is string str && DateTime.TryParse(str, out var result))
        {
            return result;
        }
        return DateTime.Now;
    }
}

```

### StringExtensions.cs

```csharp
namespace Win_Shop.Helpers.Extensions;

/// <summary>
/// String extension methods
/// </summary>
public static class StringExtensions
{
    /// <summary>
    /// Truncate string to max length with ellipsis
    /// </summary>
    public static string Truncate(this string value, int maxLength, string suffix = "...")
    {
        if (string.IsNullOrEmpty(value)) return value;
        if (value.Length <= maxLength) return value;
        return value[..(maxLength - suffix.Length)] + suffix;
    }

    /// <summary>
    /// Format Vietnamese phone number
    /// </summary>
    public static string ToVietnamesePhone(this string phone)
    {
        if (string.IsNullOrEmpty(phone)) return phone;
        
        // Remove all non-digits
        var digits = new string(phone.Where(char.IsDigit).ToArray());
        
        // Format: 0912 345 678
        if (digits.Length == 10)
        {
            return $"{digits[..4]} {digits[4..7]} {digits[7..]}";
        }
        
        return phone;
    }

    /// <summary>
    /// Generate URL-friendly slug
    /// </summary>
    public static string ToSlug(this string value)
    {
        if (string.IsNullOrEmpty(value)) return value;
        
        // Remove accents
        var normalized = value.Normalize(System.Text.NormalizationForm.FormD);
        var chars = normalized.Where(c => 
            System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c) != 
            System.Globalization.UnicodeCategory.NonSpacingMark);
        
        var result = new string(chars.ToArray())
            .Normalize(System.Text.NormalizationForm.FormC)
            .ToLower()
            .Replace(" ", "-")
            .Replace("đ", "d");
            
        // Remove special characters
        return System.Text.RegularExpressions.Regex.Replace(result, @"[^a-z0-9\-]", "");
    }
}

```

### Register Converters trong App.xaml

```xml
<Application.Resources>
    <ResourceDictionary>
        <ResourceDictionary.MergedDictionaries>
            <XamlControlsResources xmlns="using:Microsoft.UI.Xaml.Controls" />
        </ResourceDictionary.MergedDictionaries>
        
        <local:BoolToVisibilityConverter x:Key="BoolToVisibilityConverter" 
            xmlns:local="using:Win_Shop.Helpers.Converters"/>
        <local:CurrencyConverter x:Key="CurrencyConverter" 
            xmlns:local="using:Win_Shop.Helpers.Converters"/>
        <local:DateTimeConverter x:Key="DateTimeConverter" 
            xmlns:local="using:Win_Shop.Helpers.Converters"/>
    </ResourceDictionary>
</Application.Resources>

```

### ✅ Checklist Task 1.7

* [ ] BoolToVisibilityConverter với Invert support
* [ ] CurrencyConverter format VND
* [ ] DateTimeConverter với custom format
* [ ] StringExtensions helpers
* [ ] Register trong App.xaml

---

# 🎨 TASK 1.8: LOGIN PAGE UI ⏱ [4h]

## File cần sửa: `Win_Shop/Views/LoginPage.xaml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<Page
    x:Class="Win_Shop.Views.LoginPage"
    xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
    xmlns:d="http://schemas.microsoft.com/expression/blend/2008"
    xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
    xmlns:converters="using:Win_Shop.Helpers.Converters"
    mc:Ignorable="d"
    Background="{ThemeResource ApplicationPageBackgroundThemeBrush}">

    <Page.Resources>
        <converters:BoolToVisibilityConverter x:Key="BoolToVis"/>
        <converters:BoolToVisibilityConverter x:Key="InverseBoolToVis" Invert="True"/>
    </Page.Resources>

    <Grid>
        <Grid.Background>
            <LinearGradientBrush StartPoint="0,0" EndPoint="1,1">
                <GradientStop Color="#667eea" Offset="0"/>
                <GradientStop Color="#764ba2" Offset="1"/>
            </LinearGradientBrush>
        </Grid.Background>

        <Border 
            HorizontalAlignment="Center"
            VerticalAlignment="Center"
            Width="400"
            Padding="40"
            CornerRadius="16"
            Background="{ThemeResource CardBackgroundFillColorDefaultBrush}">
            
            <Border.Shadow>
                <ThemeShadow/>
            </Border.Shadow>

            <StackPanel Spacing="24">
                <StackPanel HorizontalAlignment="Center" Spacing="8">
                    <FontIcon 
                        Glyph="&#xE719;" 
                        FontSize="48" 
                        Foreground="{ThemeResource AccentFillColorDefaultBrush}"/>
                    <TextBlock 
                        Text="MyShop 2025" 
                        Style="{StaticResource TitleLargeTextBlockStyle}"
                        HorizontalAlignment="Center"/>
                    <TextBlock 
                        Text="Đăng nhập để tiếp tục" 
                        Style="{StaticResource BodyTextBlockStyle}"
                        Foreground="{ThemeResource TextFillColorSecondaryBrush}"
                        HorizontalAlignment="Center"/>
                </StackPanel>

                <InfoBar
                    x:Name="ErrorInfoBar"
                    IsOpen="{x:Bind ViewModel.HasError, Mode=OneWay}"
                    Severity="Error"
                    Title="Lỗi"
                    Message="{x:Bind ViewModel.ErrorMessage, Mode=OneWay}"
                    IsClosable="True"/>

                <TextBox
                    x:Name="EmailTextBox"
                    Header="Email"
                    PlaceholderText="admin@myshop.com"
                    Text="{x:Bind ViewModel.Email, Mode=TwoWay, UpdateSourceTrigger=PropertyChanged}"
                    IsEnabled="{x:Bind ViewModel.IsLoading, Mode=OneWay, Converter={StaticResource InverseBoolToVis}}"/>

                <PasswordBox
                    x:Name="PasswordBox"
                    Header="Mật khẩu"
                    PlaceholderText="Nhập mật khẩu"
                    Password="{x:Bind ViewModel.Password, Mode=TwoWay, UpdateSourceTrigger=PropertyChanged}"
                    IsEnabled="{x:Bind ViewModel.IsLoading, Mode=OneWay, Converter={StaticResource InverseBoolToVis}}"
                    KeyDown="PasswordBox_KeyDown"/>

                <CheckBox
                    Content="Ghi nhớ đăng nhập"
                    IsChecked="{x:Bind ViewModel.RememberMe, Mode=TwoWay}"/>

                <Button
                    Content="Đăng nhập"
                    Style="{StaticResource AccentButtonStyle}"
                    HorizontalAlignment="Stretch"
                    Height="44"
                    Command="{x:Bind ViewModel.LoginCommand}"
                    IsEnabled="{x:Bind ViewModel.IsLoading, Mode=OneWay, Converter={StaticResource InverseBoolToVis}}"/>

                <ProgressRing
                    IsActive="{x:Bind ViewModel.IsLoading, Mode=OneWay}"
                    Visibility="{x:Bind ViewModel.IsLoading, Mode=OneWay, Converter={StaticResource BoolToVis}}"
                    HorizontalAlignment="Center"/>

                <TextBlock 
                    Text="© 2025 MyShop - Phần mềm quản lý bán hàng"
                    Style="{StaticResource CaptionTextBlockStyle}"
                    Foreground="{ThemeResource TextFillColorSecondaryBrush}"
                    HorizontalAlignment="Center"/>
            </StackPanel>
        </Border>
    </Grid>
</Page>

```

## File cần sửa: `Win_Shop/Views/LoginPage.xaml.cs`

```csharp
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;
using Win_Shop.ViewModels;

namespace Win_Shop.Views;

public sealed partial class LoginPage : Page
{
    public LoginViewModel ViewModel { get; }

    public LoginPage()
    {
        this.InitializeComponent();
        ViewModel = App.GetService<LoginViewModel>();
        this.DataContext = ViewModel;
        
        // Trigger auto-login check
        this.Loaded += async (s, e) => await ViewModel.OnNavigatedToAsync();
    }

    private void PasswordBox_KeyDown(object sender, KeyRoutedEventArgs e)
    {
        if (e.Key == Windows.System.VirtualKey.Enter)
        {
            if (ViewModel.LoginCommand.CanExecute(null))
            {
                ViewModel.LoginCommand.Execute(null);
            }
        }
    }
}

```

### ✅ Checklist Task 1.8

* [ ] Gradient background
* [ ] Card với shadow
* [ ] Logo và title
* [ ] Email TextBox
* [ ] Password PasswordBox
* [ ] Remember Me checkbox
* [ ] Login button với accent style
* [ ] Loading ProgressRing
* [ ] Error InfoBar
* [ ] Enter key handler

---

# 🐚 TASK 1.9: SHELL PAGE & NAVIGATION ⏱ [5h]

## File cần sửa: `Win_Shop/Views/ShellPage.xaml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<Page
    x:Class="Win_Shop.Views.ShellPage"
    xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
    xmlns:d="http://schemas.microsoft.com/expression/blend/2008"
    xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
    mc:Ignorable="d">

    <Grid>
        <NavigationView
            x:Name="NavView"
            IsBackButtonVisible="Collapsed"
            IsSettingsVisible="False"
            PaneDisplayMode="Left"
            OpenPaneLength="280"
            SelectionChanged="NavView_SelectionChanged"
            Loaded="NavView_Loaded">
            
            <NavigationView.Header>
                <Grid Padding="0,8,24,0">
                    <Grid.ColumnDefinitions>
                        <ColumnDefinition Width="*"/>
                        <ColumnDefinition Width="Auto"/>
                    </Grid.ColumnDefinitions>
                    
                    <TextBlock 
                        x:Name="PageTitleTextBlock"
                        Text="Dashboard" 
                        Style="{StaticResource TitleTextBlockStyle}"/>
                    
                    <StackPanel Grid.Column="1" Orientation="Horizontal" Spacing="12">
                        <PersonPicture 
                            Width="32" Height="32"
                            DisplayName="{x:Bind ViewModel.CurrentUserName, Mode=OneWay}"/>
                        <StackPanel VerticalAlignment="Center">
                            <TextBlock 
                                Text="{x:Bind ViewModel.CurrentUserName, Mode=OneWay}" 
                                Style="{StaticResource BodyStrongTextBlockStyle}"/>
                            <TextBlock 
                                Text="{x:Bind ViewModel.CurrentUserRole, Mode=OneWay}" 
                                Style="{StaticResource CaptionTextBlockStyle}"
                                Foreground="{ThemeResource TextFillColorSecondaryBrush}"/>
                        </StackPanel>
                        <Button 
                            Content="Đăng xuất"
                            Command="{x:Bind ViewModel.LogoutCommand}"/>
                    </StackPanel>
                </Grid>
            </NavigationView.Header>

            <NavigationView.MenuItems>
                <NavigationViewItem Content="Dashboard" Tag="Dashboard" Icon="Home"/>
                <NavigationViewItem Content="Sản phẩm" Tag="Products" Icon="Shop"/>
                <NavigationViewItem Content="Đơn hàng" Tag="Orders" Icon="ShoppingCart"/>
                <NavigationViewItem Content="Khách hàng" Tag="Customers" Icon="People"/>
                <NavigationViewItem Content="Khuyến mãi" Tag="Coupons" Icon="Tag"/>
            </NavigationView.MenuItems>

            <NavigationView.FooterMenuItems>
                <NavigationViewItem Content="Cài đặt" Tag="Settings" Icon="Setting"/>
            </NavigationView.FooterMenuItems>

            <Frame x:Name="ContentFrame"/>
        </NavigationView>
    </Grid>
</Page>

```

## File cần sửa: `Win_Shop/Views/ShellPage.xaml.cs`

```csharp
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Win_Shop.ViewModels;
using Win_Shop.Services.Interfaces;

namespace Win_Shop.Views;

public sealed partial class ShellPage : Page
{
    public ShellViewModel ViewModel { get; }
    private readonly INavigationService _navigationService;

    public ShellPage()
    {
        this.InitializeComponent();
        ViewModel = App.GetService<ShellViewModel>();
        _navigationService = App.GetService<INavigationService>();
        
        // Register frame for navigation
        _navigationService.RegisterFrame(ContentFrame);
        
        this.DataContext = ViewModel;
    }

    private void NavView_Loaded(object sender, RoutedEventArgs e)
    {
        // Select first item (Dashboard)
        if (NavView.MenuItems.Count > 0)
        {
            NavView.SelectedItem = NavView.MenuItems[0];
        }
    }

    private void NavView_SelectionChanged(NavigationView sender, NavigationViewSelectionChangedEventArgs args)
    {
        if (args.SelectedItemContainer is NavigationViewItem item)
        {
            var tag = item.Tag?.ToString();
            NavigateToPage(tag);
            PageTitleTextBlock.Text = item.Content?.ToString() ?? "";
        }
    }

    private void NavigateToPage(string? tag)
    {
        Type? pageType = tag switch
        {
            "Dashboard" => typeof(DashboardPage),
            "Products" => typeof(ProductPage),
            "Orders" => typeof(OrderPage),
            "Customers" => typeof(CustomerPage),
            "Coupons" => typeof(CouponPage),
            "Settings" => typeof(SettingsPage),
            _ => null
        };

        if (pageType != null)
        {
            ContentFrame.Navigate(pageType);
        }
    }
}

```

## File cần sửa: `Win_Shop/ViewModels/ShellViewModel.cs`

```csharp
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Win_Shop.Services.Interfaces;
using Win_Shop.ViewModels.Base;

namespace Win_Shop.ViewModels;

/// <summary>
/// Shell/Main layout ViewModel
/// </summary>
public partial class ShellViewModel : ViewModelBase
{
    private readonly IAuthService _authService;
    private readonly INavigationService _navigationService;

    [ObservableProperty]
    private string _currentUserName = "User";

    [ObservableProperty]
    private string _currentUserRole = "Sale";

    public ShellViewModel(IAuthService authService, INavigationService navigationService)
    {
        _authService = authService;
        _navigationService = navigationService;
        LoadCurrentUser();
    }

    private void LoadCurrentUser()
    {
        var user = _authService.CurrentUser;
        if (user != null)
        {
            CurrentUserName = user.FullName ?? user.Email;
            CurrentUserRole = user.IsAdmin ? "Admin" : "Sale";
        }
    }

    [RelayCommand]
    private async Task LogoutAsync()
    {
        await _authService.SignOutAsync();
        await _authService.ClearCredentialsAsync();
        
        // Navigate back to login
        _navigationService.SetRootContent(typeof(Views.LoginPage));
    }
}

```

### ✅ Checklist Task 1.9

* [ ] NavigationView với menu items
* [ ] Header với user info
* [ ] Content Frame
* [ ] Navigation logic
* [ ] ShellViewModel với CurrentUser
* [ ] Logout command
* [ ] Page title update

---

# 🪟 TASK 1.10: MAIN WINDOW SETUP ⏱ [1h]

## File cần sửa: `Win_Shop/MainWindow.xaml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<Window
    x:Class="Win_Shop.MainWindow"
    xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
    xmlns:d="http://schemas.microsoft.com/expression/blend/2008"
    xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
    mc:Ignorable="d"
    Title="MyShop 2025">

    <Frame x:Name="RootFrame"/>
</Window>

```

## File cần sửa: `Win_Shop/MainWindow.xaml.cs`

```csharp
using Microsoft.UI.Xaml;
using Win_Shop.Views;

namespace Win_Shop;

public sealed partial class MainWindow : Window
{
    public MainWindow()
    {
        this.InitializeComponent();
        
        // Set minimum window size
        var appWindow = this.AppWindow;
        appWindow.Resize(new Windows.Graphics.SizeInt32(1280, 800));
        
        // Navigate to Login page initially
        RootFrame.Navigate(typeof(LoginPage));
    }
}

```

### ✅ Checklist Task 1.10

* [ ] RootFrame setup
* [ ] Window title
* [ ] Initial size
* [ ] Navigate to LoginPage

---

# ✅ SPRINT 1 COMPLETE CHECKLIST

Sau khi hoàn thành Sprint 1, bạn phải có:

* [ ] **DI Container** - App.GetService<T>() hoạt động
* [ ] **SupabaseService** - Connect thành công
* [ ] **ViewModelBase** - Base class với helpers
* [ ] **AuthService** - Login/logout hoạt động
* [ ] **NavigationService** - Navigate giữa các pages
* [ ] **Converters** - 3 converters registered
* [ ] **LoginPage** - UI đẹp, login thành công
* [ ] **ShellPage** - Navigation menu hoạt động
* [ ] **MainWindow** - Khởi động app đúng

## Test Checklist

1. [ ] App khởi động không lỗi
2. [ ] Hiển thị LoginPage
3. [ ] Nhập email/password và login thành công
4. [ ] Redirect đến ShellPage/Dashboard
5. [ ] Navigate giữa các menu items
6. [ ] User info hiển thị đúng
7. [ ] Logout và về LoginPage
8. [ ] Remember Me hoạt động

---

# ⏭ TIẾP TỤC: SPRINT 2 - DASHBOARD

*(Tài liệu Sprint 2 sẽ có trong file riêng)*

**Sprint 2 Tasks:**

* DashboardViewModel
* Dashboard Service Methods
* Realtime Setup
* StatCard Control
* DashboardPage với Charts
* SettingsPage

---

# ℹ️ QUICK REFERENCE

## Resolve Service từ DI

```csharp
var service = App.GetService<IAuthService>();

```

## Create ViewModel với DI

```csharp
public MyPage()
{
    ViewModel = App.GetService<MyViewModel>();
}

```

## Navigation

```csharp
_navigationService.NavigateTo<MyPage>();

```

## Execute Async với Loading

```csharp
await ExecuteAsync(async () =>
{
    // Your async code
}, "Error prefix");

```

## Binding trong XAML

```xml
<TextBlock Text="{x:Bind ViewModel.Name, Mode=OneWay}"/>
<Button Command="{x:Bind ViewModel.SaveCommand}"/>
<ProgressRing IsActive="{x:Bind ViewModel.IsLoading, Mode=OneWay}"/>

```

---

**Good luck! 🚀**
