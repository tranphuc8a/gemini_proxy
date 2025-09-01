package com.tranphuc8a.gemini_proxy.adapter.out.mysql.entities;

public interface TableEntity<T> {

    T toDomain();

    T toDomainLight();

    TableEntity<T> fromDomain(T domain);

    TableEntity<T> fromDomainLight(T domain);

}
