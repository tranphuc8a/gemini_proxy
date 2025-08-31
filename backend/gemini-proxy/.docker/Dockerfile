# Sử dụng image chính thức của OpenJDK
FROM eclipse-temurin:17-jdk-alpine

# Đặt thư mục làm việc trong container
WORKDIR /app

# Copy file jar đã build vào container
ARG JAR_FILE=target/*.jar
COPY ${JAR_FILE} app.jar

# Cần để ứng dụng đọc được biến môi trường trong container
# (chỉ định port để Spring Boot chạy)
EXPOSE 6789

# Lệnh khởi chạy ứng dụng
ENTRYPOINT ["java", "-jar", "app.jar"]
