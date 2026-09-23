FROM apache/airflow:3.3.2-python3.12

USER airflow

COPY --chown=airflow:0 pyproject.toml /opt/foil-pipeline/pyproject.toml
COPY --chown=airflow:0 src /opt/foil-pipeline/src

RUN pip install --no-cache-dir /opt/foil-pipeline \
    "apache-airflow-providers-cncf-kubernetes>=10.0,<11"

ENV PYTHONUNBUFFERED=1
ENV FOIL_DUCKDB_TARGET=md:foil_oracle_lake
